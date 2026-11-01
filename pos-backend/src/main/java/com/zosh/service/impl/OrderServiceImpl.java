package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.mapper.OrderMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.payload.dto.OrderItemDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.InventoryService;
import com.zosh.service.OrderService;
import com.zosh.service.UserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final UserService userService;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final BranchRepository branchRepository;
    private final CouponRepository couponRepository;
    private final CustomerRepository customerRepository;
    private final InventoryService inventoryService;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final AccessControlService accessControl;

    private static final double VND_PER_POINT_EARNED = 10000.0;
    private static final double VND_PER_POINT_REDEEMED = 1000.0;
    private static final double DEFAULT_TAX_RATE = 10.0;
    private static final Pattern POINTS_USED_PATTERN = Pattern.compile("-(\\d+)\\s*pts");

    /** Số điểm đã dùng để giảm giá trong đơn (được ghi trong couponCode dạng "POINTS (-N pts)"). */
    private int extractPointsUsed(Order order) {
        if (order.getCouponCode() == null || !order.getCouponCode().startsWith("POINTS")) {
            return 0;
        }
        Matcher matcher = POINTS_USED_PATTERN.matcher(order.getCouponCode());
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
    }

    /** Hoàn lại điểm đã dùng và thu hồi phần điểm đã tích CHƯA bị khấu trừ bởi các lần hoàn tiền một phần trước đó. */
    private void revertRemainingCustomerLoyalty(Order order, List<Refund> priorRefunds) {
        if (order.getCustomer() == null) {
            return;
        }
        Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                .orElse(order.getCustomer());
        int currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
        int totalEarned = (int) Math.floor((order.getTotalAmount() != null ? order.getTotalAmount() : 0.0) / VND_PER_POINT_EARNED);
        // Điểm đã thu hồi theo LŨY KẾ tổng tiền đã hoàn (khớp RefundServiceImpl), không cộng floor từng lần hoàn
        // để tránh lệch làm tròn khi hoàn tiền nhiều lần.
        double totalRefundedAmount = priorRefunds == null ? 0.0 : priorRefunds.stream()
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();
        int alreadyDeductedByRefunds = Math.min(totalEarned, (int) Math.floor(totalRefundedAmount / VND_PER_POINT_EARNED));
        int remainingEarnedToDeduct = Math.max(0, totalEarned - alreadyDeductedByRefunds);
        // Đơn chưa ở trạng thái REFUNDED thì điểm đã dùng (POINTS coupon) chưa được hoàn trả ở bước hoàn tiền một phần
        int usedToRestore = extractPointsUsed(order);
        int updated = Math.max(0, currentPoints + usedToRestore - remainingEarnedToDeduct);
        if (updated != currentPoints) {
            customer.setLoyaltyPoints(updated);
            customerRepository.save(customer);
        }
    }

    /** Hoàn kho các sản phẩm trong đơn, trừ đi số lượng đã hoàn kho ở các lần hoàn tiền một phần trước đó. */
    private void restoreRemainingOrderInventory(Order order, List<Refund> priorRefunds) {
        if (order.getBranch() == null || order.getItems() == null) {
            return;
        }
        Map<Long, Integer> alreadyRestoredByOrderItemId = new HashMap<>();
        Map<Long, Integer> alreadyRestoredByProductId = new HashMap<>();
        if (priorRefunds != null) {
            for (Refund r : priorRefunds) {
                if (r.getItems() == null) continue;
                for (RefundItem ri : r.getItems()) {
                    int q = ri.getQuantity() != null ? ri.getQuantity() : 0;
                    if (q <= 0) continue;
                    if (ri.getOrderItemId() != null) {
                        alreadyRestoredByOrderItemId.merge(ri.getOrderItemId(), q, Integer::sum);
                    } else if (ri.getProductId() != null) {
                        alreadyRestoredByProductId.merge(ri.getProductId(), q, Integer::sum);
                    }
                }
            }
        }

        List<OrderItem> sortedItems = order.getItems().stream()
                .filter(i -> i.getProduct() != null && i.getProduct().getId() != null)
                .sorted(Comparator.comparing(i -> i.getProduct().getId()))
                .collect(Collectors.toList());
        for (OrderItem item : sortedItems) {
            int orderedQty = item.getQuantity() != null ? item.getQuantity() : 0;
            int alreadyRestored = item.getId() != null ? alreadyRestoredByOrderItemId.getOrDefault(item.getId(), 0) : 0;
            if (alreadyRestored == 0) {
                int fallbackProd = alreadyRestoredByProductId.getOrDefault(item.getProduct().getId(), 0);
                if (fallbackProd > 0) {
                    int consume = Math.min(orderedQty, fallbackProd);
                    alreadyRestored = consume;
                    alreadyRestoredByProductId.put(item.getProduct().getId(), fallbackProd - consume);
                }
            }
            int remainingToRestore = Math.max(0, orderedQty - alreadyRestored);
            if (remainingToRestore <= 0) {
                continue;
            }
            try {
                inventoryService.restoreInventory(
                        item.getProduct().getId(),
                        order.getBranch().getId(),
                        remainingToRestore
                );
            } catch (Exception e) {
                log.warn("Could not restore inventory for product {} of order {}: {}",
                        item.getProduct().getId(), order.getId(), e.getMessage());
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO createOrder(OrderDTO orderDTO) throws Exception {
        User cashier = userService.getCurrentUser();

        // Thu ngân bắt buộc phải mở ca làm việc trước khi tạo đơn hàng tại quầy POS
        if (cashier.getRole() == UserRole.ROLE_BRANCH_CASHIER) {
            boolean hasActiveShift = shiftReportRepository
                    .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier)
                    .isPresent();
            if (!hasActiveShift) {
                throw new Exception("Vui lòng bắt đầu ca làm việc (Start Shift) trước khi tạo đơn hàng.");
            }
        }

        if (orderDTO.getStatus() == OrderStatus.REFUNDED || orderDTO.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("A new order cannot be created with status " + orderDTO.getStatus());
        }

        Branch branch;
        if (cashier.getBranch() != null) {
            if (orderDTO.getBranchId() != null && !cashier.getBranch().getId().equals(orderDTO.getBranchId())) {
                throw new Exception("You do not have permission to create orders for another branch");
            }
            branch = cashier.getBranch();
        } else if (orderDTO.getBranchId() != null) {
            branch = branchRepository.findById(orderDTO.getBranchId())
                    .orElseThrow(() -> new Exception("Branch not found with id: " + orderDTO.getBranchId()));
        } else {
            throw new Exception("Branch is required to create an order");
        }

        // Kiểm tra trạng thái Store và quyền truy cập Branch
        if (branch.getStore() != null) {
            if (branch.getStore().getStatus() == StoreStatus.BLOCKED) {
                throw new Exception("Store is currently blocked and cannot create new orders");
            }
            if (branch.getStore().getStatus() == StoreStatus.PENDING) {
                throw new Exception("Store is pending Super Admin approval and cannot create new orders yet");
            }
        }
        if (cashier.getRole() != UserRole.ROLE_ADMIN && branch.getStore() != null) {
            Long cashierStoreId = cashier.getStore() != null
                    ? cashier.getStore().getId()
                    : (branch.getStore().getStoreAdmin() != null
                    && branch.getStore().getStoreAdmin().getId().equals(cashier.getId())
                    ? branch.getStore().getId() : null);
            if (cashierStoreId == null || !cashierStoreId.equals(branch.getStore().getId())) {
                throw new Exception("You do not have permission to create orders for this branch");
            }
        }

        if (orderDTO.getItems() == null || orderDTO.getItems().isEmpty()) {
            throw new Exception("Order must contain at least one item");
        }

        for (OrderItemDTO itemDto : orderDTO.getItems()) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new IllegalArgumentException("Item quantity must be greater than 0");
            }
        }

        Customer customer = null;
        Long reqCustomerId = orderDTO.getCustomerId() != null
                ? orderDTO.getCustomerId()
                : (orderDTO.getCustomer() != null ? orderDTO.getCustomer().getId() : null);
        if (reqCustomerId != null) {
            customer = customerRepository.findByIdWithLock(reqCustomerId)
                    .orElseThrow(() -> new Exception("Customer not found with id: " + reqCustomerId));
            if (customer.getStore() != null && branch.getStore() != null
                    && !customer.getStore().getId().equals(branch.getStore().getId())) {
                throw new IllegalArgumentException("Customer does not belong to this store");
            }
            if (customer.getStore() == null && branch.getStore() != null) {
                customer.setStore(branch.getStore());
            }
        }

        final Branch finalBranch = branch;

        Order order = Order.builder()
                .branch(finalBranch)
                .cashier(cashier)
                .customer(customer)
                .paymentType(orderDTO.getPaymentType() != null ? orderDTO.getPaymentType() : PaymentType.CASH)
                .note(orderDTO.getNote())
                .status(orderDTO.getStatus() != null ? orderDTO.getStatus() : OrderStatus.COMPLETED)
                .build();

        List<Long> productIds = orderDTO.getItems().stream()
                .map(OrderItemDTO::getProductId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Product> productMap = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));

        List<OrderItem> orderItems = orderDTO.getItems().stream()
                .map(itemDto -> {
                    Product product = productMap.get(itemDto.getProductId());
                    if (product == null) {
                        throw new EntityNotFoundException("Product not found with id: " + itemDto.getProductId());
                    }
                    if (product.getStore() != null && finalBranch.getStore() != null
                            && !product.getStore().getId().equals(finalBranch.getStore().getId())) {
                        throw new IllegalArgumentException("Product " + product.getId() + " does not belong to this store");
                    }
                    double unitPrice = product.getSellingPrice() != null ? product.getSellingPrice() : 0.0;

                    return OrderItem.builder()
                            .order(order)
                            .product(product)
                            .quantity(itemDto.getQuantity())
                            .price(unitPrice * itemDto.getQuantity())
                            .build();
                })
                .collect(Collectors.toList());

        double subTotal = orderItems.stream()
                .mapToDouble(OrderItem::getPrice)
                .sum();

        double discountAmount = 0.0;
        String appliedCouponCode = null;
        int pointsUsed = 0;

        if (orderDTO.getCouponCode() != null && !orderDTO.getCouponCode().trim().isEmpty()) {
            String code = orderDTO.getCouponCode().trim().toUpperCase();

            if (code.startsWith("POINTS")) {
                if (customer == null) {
                    throw new Exception("Please select a customer to redeem loyalty points");
                }
                int availablePoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
                if (availablePoints <= 0) {
                    throw new Exception("Customer does not have any loyalty points to redeem");
                }
                int maxPointsUsable = (int) Math.floor(subTotal / VND_PER_POINT_REDEEMED);
                if (maxPointsUsable <= 0) {
                    throw new Exception("Order subtotal must be at least 1,000 VND to redeem loyalty points");
                }
                pointsUsed = Math.min(availablePoints, maxPointsUsable);
                discountAmount = pointsUsed * VND_PER_POINT_REDEEMED;
                appliedCouponCode = "POINTS (-" + pointsUsed + " pts)";
            } else {
                if (finalBranch.getStore() == null) {
                    throw new Exception("Branch does not belong to a valid store to apply coupon");
                }
                Coupon coupon = couponRepository.findByCodeAndStoreId(
                                code,
                                finalBranch.getStore().getId())
                        .orElseThrow(() -> new Exception("Invalid coupon code"));

                LocalDateTime now = LocalDateTime.now();
                if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
                    throw new Exception("Coupon is not active yet");
                }
                if (coupon.getValidUntil() != null && now.isAfter(coupon.getValidUntil())) {
                    throw new Exception("Coupon is expired");
                }
                if (Boolean.FALSE.equals(coupon.getIsActive())) {
                    throw new Exception("Coupon is disabled");
                }
                if (coupon.getMinOrderValue() != null && subTotal < coupon.getMinOrderValue()) {
                    throw new Exception("Order amount is below minimum required for this coupon");
                }

                if ("PERCENTAGE".equalsIgnoreCase(coupon.getDiscountType())) {
                    discountAmount = (subTotal * coupon.getDiscountValue()) / 100.0;
                } else if ("FLAT".equalsIgnoreCase(coupon.getDiscountType())) {
                    discountAmount = coupon.getDiscountValue();
                }

                if (discountAmount > subTotal) {
                    discountAmount = subTotal;
                }
                appliedCouponCode = coupon.getCode();
            }
        } else if (orderDTO.getDiscountAmount() != null && orderDTO.getDiscountAmount() > 0) {
            discountAmount = Math.min(orderDTO.getDiscountAmount(), subTotal);
        }

        // Tính thuế (taxAmount) tại Server dựa trên cấu hình store.taxRate (mặc định 10%), không phụ thuộc client gửi lên
        double configuredTaxRate = (finalBranch.getStore() != null && finalBranch.getStore().getTaxRate() != null)
                ? Math.max(0.0, finalBranch.getStore().getTaxRate())
                : DEFAULT_TAX_RATE;
        // Thuế VAT tính trên số tiền sau chiết khấu
        double taxableAmount = Math.max(0.0, subTotal - discountAmount);
        double taxAmount = Math.round(taxableAmount * (configuredTaxRate / 100.0) * 100.0) / 100.0;

        double totalAmount = Math.max(0.0, taxableAmount + taxAmount);

        order.setItems(orderItems);
        order.setSubTotal(subTotal);
        order.setTaxAmount(taxAmount);
        order.setDiscountAmount(discountAmount);
        order.setCouponCode(appliedCouponCode);
        order.setTotalAmount(totalAmount);

        List<OrderItem> sortedItemsForLock = orderItems.stream()
                .sorted(Comparator.comparing(item -> item.getProduct().getId()))
                .collect(Collectors.toList());

        for (OrderItem item : sortedItemsForLock) {
            Long productId = item.getProduct().getId();
            Long branchId = finalBranch.getId();
            int qty = item.getQuantity();
            try {
                inventoryService.deductInventory(productId, branchId, qty);
            } catch (Exception e) {
                throw new Exception("Failed to deduct inventory for product id " + productId + ": " + e.getMessage());
            }
        }

        if (customer != null && order.getStatus() == OrderStatus.COMPLETED) {
            int currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
            int earnedPoints = (int) Math.floor(totalAmount / VND_PER_POINT_EARNED);
            int updatedPoints = Math.max(0, currentPoints - pointsUsed + earnedPoints);

            customer.setLoyaltyPoints(updatedPoints);
            Customer savedCustomer = customerRepository.save(customer);
            order.setCustomer(savedCustomer);
            log.info("Customer {} loyalty points updated: {} -> {} (used: {}, earned: {})",
                    customer.getId(), currentPoints, updatedPoints, pointsUsed, earnedPoints);
        } else if (customer != null && pointsUsed > 0) {
            int currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
            customer.setLoyaltyPoints(Math.max(0, currentPoints - pointsUsed));
            order.setCustomer(customerRepository.save(customer));
        }

        Order savedOrder = orderRepository.save(order);
        log.info("Order {} created successfully. Inventory deducted for {} items.", savedOrder.getId(), orderItems.size());

        return OrderMapper.toDTO(savedOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDTO getOrderById(Long id) throws Exception {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new Exception("Order not found with id " + id));
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), order.getBranch());
        return OrderMapper.toDTO(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO updateOrderStatus(Long id, OrderStatus status) throws Exception {
        if (status == null) {
            throw new IllegalArgumentException("Order status is required");
        }
        Order order = orderRepository.findById(id).orElseThrow(
                () -> new Exception("Order not found with id " + id)
        );
        accessControl.assertCanManageBranch(userService.getCurrentUser(), order.getBranch());

        OrderStatus current = order.getStatus();
        if (current == status) {
            return OrderMapper.toDTO(order);
        }
        if (current == OrderStatus.REFUNDED || current == OrderStatus.CANCELLED) {
            throw new IllegalStateException("Order is already " + current + " and its status can no longer be changed");
        }
        if (status == OrderStatus.REFUNDED) {
            throw new IllegalArgumentException("Use the refund function to refund an order");
        }

        if (status == OrderStatus.CANCELLED) {
            if (!refundRepository.findByOrderId(order.getId()).isEmpty()) {
                throw new IllegalStateException("This order already has refunds. Please refund the remaining amount instead of cancelling it");
            }
            restoreRemainingOrderInventory(order, Collections.emptyList());
            if (current == OrderStatus.COMPLETED || current == null) {
                revertRemainingCustomerLoyalty(order, Collections.emptyList());
            } else if (order.getCustomer() != null) {
                int used = extractPointsUsed(order);
                if (used > 0) {
                    Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                            .orElse(order.getCustomer());
                    int pts = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
                    customer.setLoyaltyPoints(pts + used);
                    customerRepository.save(customer);
                }
            }
        } else if (current == OrderStatus.PENDING && status == OrderStatus.COMPLETED && order.getCustomer() != null) {
            Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                    .orElse(order.getCustomer());
            int pts = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
            int earned = (int) Math.floor((order.getTotalAmount() != null ? order.getTotalAmount() : 0.0) / VND_PER_POINT_EARNED);
            customer.setLoyaltyPoints(pts + earned);
            customerRepository.save(customer);
        }

        order.setStatus(status);
        Order saved = orderRepository.save(order);
        return OrderMapper.toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getOrdersByBranch(Long branchId,
                                            Long customerId,
                                            Long cashierId,
                                            PaymentType paymentType,
                                            OrderStatus status) throws Exception {
        assertBranchAccessById(branchId);
        return orderRepository.findByBranchId(branchId).stream()
                .filter(order -> customerId == null ||
                        (order.getCustomer() != null &&
                                order.getCustomer().getId().equals(customerId)))
                .filter(order -> cashierId == null ||
                        (order.getCashier() != null &&
                                order.getCashier().getId().equals(cashierId)))
                .filter(order -> paymentType == null ||
                        order.getPaymentType() == paymentType)
                .filter(order -> status == null ||
                        order.getStatus() == status)
                .map(OrderMapper::toDTO)
                .collect(Collectors.toList());
    }

    private void assertBranchAccessById(Long branchId) throws Exception {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new Exception("Branch not found with id: " + branchId));
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), branch);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getOrderByCashier(Long cashierId) throws Exception {
        User current = userService.getCurrentUser();
        if (!current.getId().equals(cashierId)) {
            User target = userService.getUserById(cashierId);
            if (target.getBranch() != null) {
                accessControl.assertCanManageBranch(current, target.getBranch());
            } else if (!accessControl.isStoreLevelUser(current, target.getStore())) {
                throw new Exception("You do not have permission to view orders of this cashier");
            }
        }
        return orderRepository.findByCashierId(cashierId).stream()
                .map(OrderMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteOrder(Long id) throws Exception {
        Order order = orderRepository.findById(id).orElseThrow(
                () -> new Exception("Order not found with id " + id)
        );
        accessControl.assertCanManageBranch(userService.getCurrentUser(), order.getBranch());

        List<Refund> orderRefunds = refundRepository.findByOrderId(id);

        // Đơn REFUNDED đã hoàn kho & hoàn điểm 100%, đơn CANCELLED đã hoàn kho & điểm khi hủy -> không hoàn lần nữa
        boolean alreadyFullyReverted = order.getStatus() == OrderStatus.REFUNDED
                || order.getStatus() == OrderStatus.CANCELLED;
        if (!alreadyFullyReverted) {
            restoreRemainingOrderInventory(order, orderRefunds);
            if (order.getStatus() == OrderStatus.COMPLETED || order.getStatus() == null) {
                // Thu hồi đầy đủ phần điểm thưởng còn lại kể cả khi đơn đã từng hoàn tiền một phần (Partial Refund)
                revertRemainingCustomerLoyalty(order, orderRefunds);
            } else if (order.getCustomer() != null) {
                int used = extractPointsUsed(order);
                if (used > 0) {
                    Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                            .orElse(order.getCustomer());
                    int pts = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
                    customer.setLoyaltyPoints(pts + used);
                    customerRepository.save(customer);
                }
            }
        }

        for (Refund r : orderRefunds) {
            r.setOrder(null);
            refundRepository.save(r);
        }

        orderRepository.delete(order);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getTodayOrdersByBranch(Long branchId) throws Exception {
        assertBranchAccessById(branchId);
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();

        return orderRepository.findByBranchIdAndCreatedAtBetween(branchId, start, end)
                .stream()
                .map(OrderMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getOrdersByCustomerId(Long customerId) throws Exception {
        User current = userService.getCurrentUser();
        return orderRepository.findByCustomerId(customerId).stream()
                .filter(o -> accessControl.canAccessBranch(current, o.getBranch()))
                .map(OrderMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDTO> getTop5RecentOrdersByBranchId(Long branchId) throws Exception {
        assertBranchAccessById(branchId);
        return orderRepository.findTop5ByBranchIdOrderByCreatedAtDesc(branchId).stream()
                .map(OrderMapper::toDTO)
                .collect(Collectors.toList());
    }
}
