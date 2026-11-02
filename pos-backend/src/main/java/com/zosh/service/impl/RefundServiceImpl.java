package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.UserRole;
import com.zosh.mapper.RefundMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.dto.RefundItemDTO;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.InventoryService;
import com.zosh.service.RefundService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefundServiceImpl implements RefundService {

    private final UserService userService;
    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final InventoryService inventoryService;
    private final CustomerRepository customerRepository;
    private final AccessControlService accessControl;

    private static final double VND_PER_POINT_EARNED = 10000.0;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RefundDTO createRefund(RefundDTO refund) throws Exception {
        User cashier = userService.getCurrentUser();

        Order order = orderRepository.findById(refund.getOrderId()).orElseThrow(
                () -> new Exception("Order not found with id: " + refund.getOrderId())
        );
        accessControl.assertCanAccessBranch(cashier, order.getBranch());

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new Exception("A cancelled order cannot be refunded");
        }
        if (order.getStatus() == OrderStatus.PENDING) {
            throw new Exception("A pending unpaid order cannot be refunded. Cancel it instead.");
        }
        if (order.getStatus() == OrderStatus.REFUNDED) {
            throw new Exception("This order has already been fully refunded");
        }

        ShiftReport activeShift = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier)
                .orElse(null);
        if (cashier.getRole() == UserRole.ROLE_BRANCH_CASHIER && activeShift == null) {
            throw new Exception("Vui lòng bắt đầu ca làm việc (Start Shift) trước khi thực hiện hoàn tiền.");
        }

        List<Refund> existingRefunds = refundRepository.findByOrderId(order.getId());
        double alreadyRefunded = existingRefunds.stream()
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();

        double orderTotal = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
        double orderSubTotal = order.getSubTotal() != null && order.getSubTotal() > 0 ? order.getSubTotal() : orderTotal;
        double netOrderFactor = orderSubTotal > 0 ? (orderTotal / orderSubTotal) : 1.0;
        double remainingRefundable = Math.max(0.0, orderTotal - alreadyRefunded);

        if (remainingRefundable < 0.01) {
            throw new Exception("This order has already been refunded");
        }

        // Thống kê số lượng từng OrderItem / Product đã hoàn trả ở các lần Partial Refund trước đó
        Map<Long, Integer> returnedByOrderItemId = new HashMap<>();
        Map<Long, Integer> returnedByProductId = new HashMap<>();
        for (Refund prev : existingRefunds) {
            if (prev.getItems() == null) continue;
            for (RefundItem ri : prev.getItems()) {
                int q = ri.getQuantity() != null ? ri.getQuantity() : 0;
                if (q <= 0) continue;
                if (ri.getOrderItemId() != null) {
                    returnedByOrderItemId.merge(ri.getOrderItemId(), q, Integer::sum);
                } else if (ri.getProductId() != null) {
                    returnedByProductId.merge(ri.getProductId(), q, Integer::sum);
                }
            }
        }

        List<OrderItem> orderItems = order.getItems() != null ? order.getItems() : Collections.emptyList();
        Map<Long, Integer> remainingQtyByOrderItemId = new LinkedHashMap<>();
        for (OrderItem oi : orderItems) {
            int orderedQty = oi.getQuantity() != null ? oi.getQuantity() : 0;
            int alreadyQty = oi.getId() != null ? returnedByOrderItemId.getOrDefault(oi.getId(), 0) : 0;
            if (alreadyQty == 0 && oi.getProduct() != null && oi.getProduct().getId() != null) {
                int fallbackProdReturned = returnedByProductId.getOrDefault(oi.getProduct().getId(), 0);
                if (fallbackProdReturned > 0) {
                    int consume = Math.min(orderedQty, fallbackProdReturned);
                    alreadyQty = consume;
                    returnedByProductId.put(oi.getProduct().getId(), fallbackProdReturned - consume);
                }
            }
            remainingQtyByOrderItemId.put(oi.getId(), Math.max(0, orderedQty - alreadyQty));
        }

        Branch branch = order.getBranch();
        PaymentType paymentType = refund.getPaymentType() != null ? refund.getPaymentType() : order.getPaymentType();

        List<RefundItem> refundItemsToSave = new ArrayList<>();
        Map<Long, Integer> stockToRestoreByProduct = new TreeMap<>(); // TreeMap giữ thứ tự productId tăng dần chống deadlock
        double refundAmount;
        boolean hasRequestedItems = refund.getItems() != null && !refund.getItems().isEmpty();

        if (hasRequestedItems) {
            // Hoàn trả theo danh sách sản phẩm cụ thể (hỗ trợ cả Partial Refund lẫn Full Refund)
            Map<Long, Integer> requestedByOrderItemId = new LinkedHashMap<>();
            for (RefundItemDTO reqItem : refund.getItems()) {
                if (reqItem == null || reqItem.getQuantity() == null || reqItem.getQuantity() <= 0) {
                    continue;
                }
                OrderItem matchedOi = findMatchingOrderItem(orderItems, reqItem, remainingQtyByOrderItemId, requestedByOrderItemId);
                if (matchedOi == null) {
                    throw new IllegalArgumentException("Returned item does not belong to order #" + order.getId() + " or has no remaining returnable quantity");
                }
                int maxLeft = remainingQtyByOrderItemId.getOrDefault(matchedOi.getId(), 0)
                        - requestedByOrderItemId.getOrDefault(matchedOi.getId(), 0);
                if (reqItem.getQuantity() > maxLeft) {
                    String pName = matchedOi.getProduct() != null ? matchedOi.getProduct().getName() : ("#" + matchedOi.getId());
                    throw new IllegalArgumentException(
                            "Return quantity (" + reqItem.getQuantity() + ") for '" + pName
                                    + "' exceeds remaining returnable quantity (" + maxLeft + ")"
                    );
                }
                requestedByOrderItemId.merge(matchedOi.getId(), reqItem.getQuantity(), Integer::sum);
            }

            if (requestedByOrderItemId.isEmpty()) {
                throw new IllegalArgumentException("At least one item with quantity > 0 must be selected for refund");
            }

            boolean returningAllRemainingItems = true;
            for (OrderItem oi : orderItems) {
                int leftBefore = remainingQtyByOrderItemId.getOrDefault(oi.getId(), 0);
                int returningNow = requestedByOrderItemId.getOrDefault(oi.getId(), 0);
                if (returningNow < leftBefore) {
                    returningAllRemainingItems = false;
                }
            }

            double computedItemsNetAmount = 0.0;
            for (OrderItem oi : orderItems) {
                int returningNow = requestedByOrderItemId.getOrDefault(oi.getId(), 0);
                if (returningNow <= 0) continue;

                int orderedQty = oi.getQuantity() != null && oi.getQuantity() > 0 ? oi.getQuantity() : 1;
                double rawUnitPrice = oi.getPrice() != null
                        ? (oi.getPrice() / orderedQty)
                        : (oi.getProduct() != null && oi.getProduct().getSellingPrice() != null
                        ? oi.getProduct().getSellingPrice() : 0.0);
                double netUnitPrice = rawUnitPrice * netOrderFactor;
                double lineRefundAmount = Math.round(netUnitPrice * returningNow * 100.0) / 100.0;
                computedItemsNetAmount += lineRefundAmount;

                Long prodId = oi.getProduct() != null ? oi.getProduct().getId() : null;
                String prodName = oi.getProduct() != null ? oi.getProduct().getName() : "Deleted Product";
                if (prodId != null) {
                    stockToRestoreByProduct.merge(prodId, returningNow, Integer::sum);
                }

                refundItemsToSave.add(RefundItem.builder()
                        .orderItemId(oi.getId())
                        .productId(prodId)
                        .productName(prodName)
                        .quantity(returningNow)
                        .unitPrice(Math.round(netUnitPrice * 100.0) / 100.0)
                        .refundAmount(lineRefundAmount)
                        .build());
            }

            double itemsNetValue = Math.round(computedItemsNetAmount * 100.0) / 100.0;
            if (refund.getAmount() != null && refund.getAmount() > 0) {
                // Ưu tiên số tiền do thu ngân nhập (vd: trừ phí trả hàng) kể cả khi khách trả hết hàng còn lại
                if (refund.getAmount() > remainingRefundable + 0.01) {
                    throw new Exception("Refund amount (" + refund.getAmount() + ") exceeds remaining refundable order total (" + remainingRefundable + ")");
                }
                // Trả MỘT PHẦN hàng thì không được hoàn nhiều hơn giá trị số hàng thực trả
                // (chặn việc hoàn 100% tiền nhưng chỉ nhập kho vài sản phẩm)
                if (!returningAllRemainingItems && refund.getAmount() > itemsNetValue + 1.0) {
                    throw new IllegalArgumentException("Refund amount (" + refund.getAmount()
                            + ") exceeds the value of the returned items (" + itemsNetValue + ")");
                }
                refundAmount = Math.min(refund.getAmount(), remainingRefundable);
            } else if (returningAllRemainingItems) {
                refundAmount = remainingRefundable;
            } else {
                refundAmount = Math.min(itemsNetValue, remainingRefundable);
            }
        } else {
            // Không truyền danh sách items: cho phép hoàn tiền theo SỐ TIỀN (hoàn một phần hoặc toàn phần).
            // Hoàn một phần theo số tiền không đổi tồn kho; chỉ khi tổng tiền hoàn đạt 100% đơn mới cộng trả phần hàng còn lại.
            refundAmount = (refund.getAmount() != null && refund.getAmount() > 0)
                    ? refund.getAmount()
                    : remainingRefundable;

            if (refundAmount <= 0) {
                throw new IllegalArgumentException("Refund amount must be greater than 0");
            }
            if (alreadyRefunded + refundAmount > orderTotal + 0.01) {
                throw new Exception(
                        "Refund amount (" + refundAmount + ") exceeds remaining refundable order total (" + remainingRefundable + ")");
            }

            boolean reachesFullOrder = (alreadyRefunded + refundAmount) >= (orderTotal - 0.01);

            // Hoàn nốt phần còn lại của đơn -> chỉ cộng trả số lượng sản phẩm CHƯA từng được hoàn kho trước đó!
            for (OrderItem oi : (reachesFullOrder ? orderItems : Collections.<OrderItem>emptyList())) {
                int remainingQty = remainingQtyByOrderItemId.getOrDefault(oi.getId(), 0);
                if (remainingQty <= 0) continue;

                int orderedQty = oi.getQuantity() != null && oi.getQuantity() > 0 ? oi.getQuantity() : 1;
                double rawUnitPrice = oi.getPrice() != null
                        ? (oi.getPrice() / orderedQty)
                        : (oi.getProduct() != null && oi.getProduct().getSellingPrice() != null
                        ? oi.getProduct().getSellingPrice() : 0.0);
                double netUnitPrice = rawUnitPrice * netOrderFactor;
                double lineRefundAmount = Math.round(netUnitPrice * remainingQty * 100.0) / 100.0;

                Long prodId = oi.getProduct() != null ? oi.getProduct().getId() : null;
                String prodName = oi.getProduct() != null ? oi.getProduct().getName() : "Deleted Product";
                if (prodId != null) {
                    stockToRestoreByProduct.merge(prodId, remainingQty, Integer::sum);
                }

                refundItemsToSave.add(RefundItem.builder()
                        .orderItemId(oi.getId())
                        .productId(prodId)
                        .productName(prodName)
                        .quantity(remainingQty)
                        .unitPrice(Math.round(netUnitPrice * 100.0) / 100.0)
                        .refundAmount(lineRefundAmount)
                        .build());
            }
        }

        if (refundAmount <= 0) {
            throw new IllegalArgumentException("Refund amount must be greater than 0");
        }

        // Cộng trả kho NGAY LẬP TỨC theo đúng số lượng sản phẩm khách trả trong lần hoàn tiền này
        if (branch != null && !stockToRestoreByProduct.isEmpty()) {
            for (Map.Entry<Long, Integer> entry : stockToRestoreByProduct.entrySet()) {
                Long productId = entry.getKey();
                int qtyToRestore = entry.getValue();
                if (qtyToRestore > 0) {
                    inventoryService.restoreInventory(productId, branch.getId(), qtyToRestore);
                    log.info("Restored {} units of product {} to branch {} for refund on order {}",
                            qtyToRestore, productId, branch.getId(), order.getId());
                }
            }
        }

        double totalRefundedAfter = alreadyRefunded + refundAmount;
        boolean isFullRefund = totalRefundedAfter >= orderTotal - 0.01;
        if (isFullRefund) {
            order.setStatus(OrderStatus.REFUNDED);
            orderRepository.save(order);
        }

        Refund createdRefund = Refund.builder()
                .order(order)
                .cashier(cashier)
                .branch(branch)
                .shiftReport(activeShift)
                .reason(refund.getReason())
                .amount(refundAmount)
                .paymentType(paymentType)
                .createdAt(LocalDateTime.now())
                .build();

        for (RefundItem ri : refundItemsToSave) {
            ri.setRefund(createdRefund);
        }
        createdRefund.setItems(refundItemsToSave);

        // Thu hồi & hoàn trả điểm tích lũy của khách hàng khi hoàn tiền
        if (order.getCustomer() != null) {
            Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                    .orElse(order.getCustomer());
            int currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;

            // Điểm thu hồi tính theo LŨY KẾ tổng tiền đã hoàn để không mất điểm do làm tròn floor từng lần hoàn nhỏ
            int totalEarnedOnOrder = (int) Math.floor(orderTotal / VND_PER_POINT_EARNED);
            int cumulativeDeductedBefore = Math.min(totalEarnedOnOrder,
                    (int) Math.floor(alreadyRefunded / VND_PER_POINT_EARNED));
            int cumulativeDeductedAfter = isFullRefund
                    ? totalEarnedOnOrder
                    : Math.min(totalEarnedOnOrder, (int) Math.floor(totalRefundedAfter / VND_PER_POINT_EARNED));
            int pointsToDeduct = Math.max(0, cumulativeDeductedAfter - cumulativeDeductedBefore);
            int pointsToRestore = isFullRefund ? extractPointsUsed(order) : 0;

            int updatedPoints = Math.max(0, currentPoints + pointsToRestore - pointsToDeduct);
            if (updatedPoints != currentPoints) {
                customer.setLoyaltyPoints(updatedPoints);
                customerRepository.save(customer);
            }
        }

        Refund savedRefund = refundRepository.save(createdRefund);
        return RefundMapper.toDTO(savedRefund);
    }

    private OrderItem findMatchingOrderItem(
            List<OrderItem> orderItems,
            RefundItemDTO reqItem,
            Map<Long, Integer> remainingQtyByOrderItemId,
            Map<Long, Integer> requestedByOrderItemId
    ) {
        if (reqItem.getOrderItemId() != null) {
            return orderItems.stream()
                    .filter(oi -> reqItem.getOrderItemId().equals(oi.getId()))
                    .findFirst()
                    .orElse(null);
        }
        if (reqItem.getProductId() != null) {
            return orderItems.stream()
                    .filter(oi -> oi.getProduct() != null && reqItem.getProductId().equals(oi.getProduct().getId()))
                    .filter(oi -> remainingQtyByOrderItemId.getOrDefault(oi.getId(), 0)
                            - requestedByOrderItemId.getOrDefault(oi.getId(), 0) > 0)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getAllRefunds() throws Exception {
        User current = userService.getCurrentUser();
        List<Refund> scopedRefunds;
        if (current.getRole() == UserRole.ROLE_ADMIN) {
            scopedRefunds = refundRepository.findAll();
        } else if (current.getRole() == UserRole.ROLE_BRANCH_MANAGER
                || current.getRole() == UserRole.ROLE_BRANCH_CASHIER) {
            if (current.getBranch() == null) {
                return Collections.emptyList();
            }
            scopedRefunds = refundRepository.findByBranchId(current.getBranch().getId());
        } else {
            Store store = accessControl.resolveStoreOfUser(current);
            if (store == null) {
                return Collections.emptyList();
            }
            scopedRefunds = refundRepository.findByBranchStoreId(store.getId());
        }
        return scopedRefunds.stream()
                .filter(r -> current.getRole() == UserRole.ROLE_ADMIN || accessControl.canAccessBranch(current, r.getBranch()))
                .map(RefundMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getRefundByCashier(Long cashierId) throws Exception {
        User current = userService.getCurrentUser();
        return refundRepository.findByCashierId(cashierId).stream()
                .filter(r -> current.getId().equals(cashierId)
                        || accessControl.canManageBranch(current, r.getBranch()))
                .map(RefundMapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getRefundByShiftReport(Long shiftReportId) throws Exception {
        User current = userService.getCurrentUser();
        return refundRepository.findByShiftReportId(shiftReportId).stream()
                .filter(r -> accessControl.canAccessBranch(current, r.getBranch()))
                .map(RefundMapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getRefundByCashierAndDateRange(Long cashierId,
                                                          LocalDateTime startDate,
                                                          LocalDateTime endDate) throws Exception {
        User current = userService.getCurrentUser();
        return refundRepository.findByCashierIdAndCreatedAtBetween(cashierId, startDate, endDate)
                .stream()
                .filter(r -> current.getId().equals(cashierId)
                        || accessControl.canManageBranch(current, r.getBranch()))
                .map(RefundMapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getRefundByBranch(Long branchId) throws Exception {
        User current = userService.getCurrentUser();
        return refundRepository.findByBranchId(branchId).stream()
                .filter(r -> accessControl.canAccessBranch(current, r.getBranch()))
                .map(RefundMapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public RefundDTO getRefundById(Long refundId) throws Exception {
        Refund refund = refundRepository.findById(refundId).orElseThrow(
                () -> new Exception("Refund not found with id: " + refundId)
        );
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), refund.getBranch());
        return RefundMapper.toDTO(refund);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRefund(Long refundId) throws Exception {
        Refund refund = refundRepository.findById(refundId).orElseThrow(
                () -> new Exception("Refund not found with id: " + refundId)
        );
        Store refundStore = refund.getBranch() != null ? refund.getBranch().getStore()
                : (refund.getOrder() != null && refund.getOrder().getBranch() != null
                ? refund.getOrder().getBranch().getStore()
                : accessControl.resolveStoreOfUser(refund.getCashier()));
        accessControl.assertStoreLevelOrAdmin(userService.getCurrentUser(), refundStore);

        Order order = refund.getOrder();
        if (order != null) {
            double refundAmount = refund.getAmount() != null ? refund.getAmount() : 0.0;
            double orderTotal = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
            List<Refund> otherRefunds = refundRepository.findByOrderId(order.getId()).stream()
                    .filter(r -> !r.getId().equals(refund.getId()))
                    .collect(Collectors.toList());
            double remainingRefunded = otherRefunds.stream()
                    .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                    .sum();
            boolean otherRefundsHaveItems = otherRefunds.stream()
                    .anyMatch(r -> r.getItems() != null && !r.getItems().isEmpty());

            boolean orderWasFullyRefunded = order.getStatus() == OrderStatus.REFUNDED;
            boolean reopenOrder = orderWasFullyRefunded && remainingRefunded < orderTotal - 0.01;

            if (order.getBranch() != null) {
                if (refund.getItems() != null && !refund.getItems().isEmpty()) {
                    // Trừ lại đúng số lượng sản phẩm đã được cộng kho trong lần hoàn tiền này
                    Map<Long, Integer> deductByProduct = new TreeMap<>();
                    for (RefundItem ri : refund.getItems()) {
                        if (ri.getProductId() != null && ri.getQuantity() != null && ri.getQuantity() > 0) {
                            deductByProduct.merge(ri.getProductId(), ri.getQuantity(), Integer::sum);
                        }
                    }
                    for (Map.Entry<Long, Integer> entry : deductByProduct.entrySet()) {
                        inventoryService.deductInventory(entry.getKey(), order.getBranch().getId(), entry.getValue());
                    }
                } else if (reopenOrder && !otherRefundsHaveItems && order.getItems() != null) {
                    // Tương thích ngược với các bản ghi Refund cũ chưa có bảng RefundItem
                    List<OrderItem> sortedItems = order.getItems().stream()
                            .filter(i -> i.getProduct() != null && i.getProduct().getId() != null)
                            .sorted(Comparator.comparing(i -> i.getProduct().getId()))
                            .collect(Collectors.toList());
                    for (OrderItem item : sortedItems) {
                        inventoryService.deductInventory(
                                item.getProduct().getId(), order.getBranch().getId(), item.getQuantity());
                    }
                }
            }

            if (reopenOrder) {
                order.setStatus(OrderStatus.COMPLETED);
                orderRepository.save(order);
            }

            // Đảo ngược điều chỉnh điểm tích lũy đã thực hiện khi tạo khoản hoàn tiền này
            if (order.getCustomer() != null) {
                Customer customer = customerRepository.findByIdWithLock(order.getCustomer().getId())
                        .orElse(order.getCustomer());
                int currentPoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
                // Đảo ngược đúng phần điểm đã thu hồi theo lũy kế khi tạo khoản hoàn này
                double totalRefundedBeforeDelete = remainingRefunded + refundAmount;
                int totalEarnedOnOrder = (int) Math.floor(orderTotal / VND_PER_POINT_EARNED);
                int cumulativeDeductedBeforeDelete = orderWasFullyRefunded
                        ? totalEarnedOnOrder
                        : Math.min(totalEarnedOnOrder, (int) Math.floor(totalRefundedBeforeDelete / VND_PER_POINT_EARNED));
                int cumulativeDeductedAfterDelete = Math.min(totalEarnedOnOrder,
                        (int) Math.floor(remainingRefunded / VND_PER_POINT_EARNED));
                int pointsDeductedBefore = Math.max(0, cumulativeDeductedBeforeDelete - cumulativeDeductedAfterDelete);
                int pointsRestoredBefore = reopenOrder ? extractPointsUsed(order) : 0;
                int updatedPoints = Math.max(0, currentPoints - pointsRestoredBefore + pointsDeductedBefore);
                if (updatedPoints != currentPoints) {
                    customer.setLoyaltyPoints(updatedPoints);
                    customerRepository.save(customer);
                }
            }
        }

        refundRepository.delete(refund);
    }

    private int extractPointsUsed(Order order) {
        if (order.getCouponCode() == null || !order.getCouponCode().startsWith("POINTS")) {
            return 0;
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("-(\\d+)\\s*pts")
                .matcher(order.getCouponCode());
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
    }
}
