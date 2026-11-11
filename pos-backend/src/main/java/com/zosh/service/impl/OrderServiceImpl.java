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
import com.zosh.service.OrderService;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.UserService;
import com.zosh.service.order.CustomerLoyaltyService;
import com.zosh.service.order.OrderInventoryCoordinator;
import com.zosh.service.order.OrderPricingCalculator;
import com.zosh.service.order.OrderPricingCalculator.DiscountResult;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final UserService userService;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final BranchRepository branchRepository;
    private final CustomerRepository customerRepository;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final AccessControlService accessControl;
    private final PaymentGatewayService paymentGatewayService;
    private final OrderPricingCalculator pricingCalculator;
    private final OrderInventoryCoordinator inventoryCoordinator;
    private final CustomerLoyaltyService loyaltyService;

    // =========================================================================
    // TẠO ĐƠN HÀNG
    // =========================================================================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO createOrder(OrderDTO orderDTO) throws Exception {
        User cashier = userService.getCurrentUser();
        if (cashier.getRole() != UserRole.ROLE_CASHIER) {
            throw new AccessDeniedException("Chỉ Thu ngân (ROLE_CASHIER) có ca đang mở mới được phép tạo đơn hàng tại quầy POS.");
        }
        assertCashierHasActiveShift(cashier);
        assertCreatableStatus(orderDTO.getStatus());

        Branch branch = resolveOrderBranch(cashier, orderDTO);
        assertStoreCanSell(branch);
        assertUserBelongsToBranchStore(cashier, branch);

        List<OrderItemDTO> normalizedItems = normalizeItems(orderDTO.getItems());
        Customer customer = resolveCustomer(orderDTO, branch);

        String reqSessionId = trimToNull(orderDTO.getPaymentSessionId());
        Order order = buildOrderHeader(orderDTO, branch, cashier, customer, reqSessionId);
        List<OrderItem> orderItems = buildOrderItems(order, normalizedItems, branch);

        DiscountResult discount = applyPricing(order, orderItems, orderDTO, customer, branch, cashier);
        double totalAmount = order.getTotalAmount();

        boolean needsGatewayPayment = requiresGatewayPayment(order, totalAmount);
        if (needsGatewayPayment && reqSessionId == null) {
            throw new AccessDeniedException(
                    "Đơn hàng thanh toán qua Thẻ hoặc QR MoMo/VietQR bắt buộc phải có phiên thanh toán xác thực từ cổng thanh toán."
            );
        }

        inventoryCoordinator.deductForItems(orderItems, branch.getId());

        // Chỉ tiêu thụ (consume) phiên thanh toán SAU KHI đã kiểm tra và trừ tồn kho thành công
        if (needsGatewayPayment) {
            consumePaymentSession(order, reqSessionId, storeIdOf(branch), totalAmount, null);
        }

        Customer savedCustomer = loyaltyService.applyForNewOrder(
                customer, order.getStatus() == OrderStatus.COMPLETED, totalAmount, discount.pointsUsed());
        if (savedCustomer != null) {
            order.setCustomer(savedCustomer);
        }

        Order savedOrder = saveAndLinkSession(order, reqSessionId);
        log.info("Order {} created with status {}. Inventory deducted for {} items.",
                savedOrder.getId(), savedOrder.getStatus(), orderItems.size());
        return OrderMapper.toDTO(savedOrder);
    }

    /** Thu ngân bắt buộc phải mở ca làm việc trước khi tạo đơn hàng tại quầy POS. */
    private void assertCashierHasActiveShift(User cashier) throws Exception {
        if (cashier.getRole() != UserRole.ROLE_CASHIER) {
            return;
        }
        boolean hasActiveShift = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier)
                .isPresent();
        if (!hasActiveShift) {
            throw new Exception("Vui lòng bắt đầu ca làm việc (Start Shift) trước khi tạo đơn hàng.");
        }
    }

    private void assertCreatableStatus(OrderStatus status) {
        if (status == OrderStatus.REFUNDED
                || status == OrderStatus.PARTIALLY_REFUNDED
                || status == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("A new order cannot be created with status " + status);
        }
    }

    private Branch resolveOrderBranch(User cashier, OrderDTO orderDTO) throws Exception {
        if (cashier.getBranch() != null) {
            if (orderDTO.getBranchId() != null && !cashier.getBranch().getId().equals(orderDTO.getBranchId())) {
                throw new Exception("You do not have permission to create orders for another branch");
            }
            return cashier.getBranch();
        }
        if (orderDTO.getBranchId() != null) {
            return branchRepository.findById(orderDTO.getBranchId())
                    .orElseThrow(() -> new Exception("Branch not found with id: " + orderDTO.getBranchId()));
        }
        throw new Exception("Branch is required to create an order");
    }

    /** Store bị khóa hoặc chưa được duyệt thì không được bán hàng. */
    private void assertStoreCanSell(Branch branch) throws Exception {
        Store store = branch.getStore();
        if (store == null) {
            return;
        }
        if (store.getStatus() == StoreStatus.BLOCKED) {
            throw new Exception("Store is currently blocked and cannot create new orders");
        }
        if (store.getStatus() == StoreStatus.PENDING || store.getStatus() == StoreStatus.REJECTED) {
            throw new Exception("Store is pending Super Admin approval and cannot create new orders yet");
        }
    }

    private void assertUserBelongsToBranchStore(User cashier, Branch branch) throws Exception {
        Store branchStore = branch.getStore();
        if (branchStore == null) {
            return;
        }
        Long cashierStoreId;
        if (cashier.getStore() != null) {
            cashierStoreId = cashier.getStore().getId();
        } else {
            boolean isStoreAdmin = branchStore.getStoreAdmin() != null
                    && branchStore.getStoreAdmin().getId().equals(cashier.getId());
            cashierStoreId = isStoreAdmin ? branchStore.getId() : null;
        }
        if (cashierStoreId == null || !cashierStoreId.equals(branchStore.getId())) {
            throw new Exception("You do not have permission to create orders for this branch");
        }
    }

    /** Kiểm tra dữ liệu dòng hàng và gộp các dòng trùng productId. */
    private List<OrderItemDTO> normalizeItems(List<OrderItemDTO> items) throws Exception {
        if (items == null || items.isEmpty()) {
            throw new Exception("Order must contain at least one item");
        }
        for (OrderItemDTO itemDto : items) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new IllegalArgumentException("Item quantity must be greater than 0");
            }
        }
        Map<Long, Integer> mergedQtyByProductId = new LinkedHashMap<>();
        for (OrderItemDTO itemDto : items) {
            if (itemDto.getProductId() == null) {
                throw new IllegalArgumentException("Product ID is required for each order item");
            }
            mergedQtyByProductId.merge(itemDto.getProductId(), itemDto.getQuantity(), Integer::sum);
        }
        return mergedQtyByProductId.entrySet().stream()
                .map(e -> OrderItemDTO.builder().productId(e.getKey()).quantity(e.getValue()).build())
                .collect(Collectors.toList());
    }

    private Customer resolveCustomer(OrderDTO orderDTO, Branch branch) throws Exception {
        Long reqCustomerId = orderDTO.getCustomerId() != null
                ? orderDTO.getCustomerId()
                : (orderDTO.getCustomer() != null ? orderDTO.getCustomer().getId() : null);
        if (reqCustomerId == null) {
            return null;
        }
        Customer customer = customerRepository.findByIdWithLock(reqCustomerId)
                .orElseThrow(() -> new Exception("Customer not found with id: " + reqCustomerId));
        if (branch.getStore() != null
                && (customer.getStore() == null || !customer.getStore().getId().equals(branch.getStore().getId()))) {
            throw new IllegalArgumentException("Customer does not belong to this store");
        }
        return customer;
    }

    private Order buildOrderHeader(OrderDTO dto, Branch branch, User cashier, Customer customer, String sessionId) {
        OrderStatus targetStatus = dto.getStatus() != null ? dto.getStatus() : OrderStatus.COMPLETED;
        PaymentType targetPaymentType = dto.getPaymentType() != null ? dto.getPaymentType() : PaymentType.CASH;
        return Order.builder()
                .branch(branch)
                .cashier(cashier)
                .customer(customer)
                .paymentType(targetPaymentType)
                .paymentSessionId(sessionId)
                .note(dto.getNote())
                .status(targetStatus)
                .paidAt(targetStatus == OrderStatus.COMPLETED ? LocalDateTime.now() : null)
                .build();
    }

    private List<OrderItem> buildOrderItems(Order order, List<OrderItemDTO> items, Branch branch) {
        List<Long> productIds = items.stream().map(OrderItemDTO::getProductId).distinct().collect(Collectors.toList());
        Map<Long, Product> productMap = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));

        return items.stream().map(itemDto -> {
            Product product = productMap.get(itemDto.getProductId());
            if (product == null) {
                throw new EntityNotFoundException("Product not found with id: " + itemDto.getProductId());
            }
            if (product.getStore() != null && branch.getStore() != null
                    && !product.getStore().getId().equals(branch.getStore().getId())) {
                throw new IllegalArgumentException("Product " + product.getId() + " does not belong to this store");
            }
            double unitPrice = product.getSellingPrice() != null ? product.getSellingPrice() : 0.0;
            return OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(itemDto.getQuantity())
                    .price(unitPrice * itemDto.getQuantity())
                    .build();
        }).collect(Collectors.toList());
    }

    /** Tính tạm tính, chiết khấu, thuế (tại Server) và gán vào đơn. */
    private DiscountResult applyPricing(Order order, List<OrderItem> items, OrderDTO dto,
                                        Customer customer, Branch branch, User cashier) throws Exception {
        double subTotal = pricingCalculator.subTotal(items);
        DiscountResult discount = pricingCalculator.computeDiscount(dto, subTotal, customer, branch, cashier);
        double taxableAmount = Math.max(0.0, subTotal - discount.amount());
        double taxAmount = pricingCalculator.computeTax(taxableAmount, branch.getStore());

        order.setItems(items);
        order.setSubTotal(subTotal);
        order.setTaxAmount(taxAmount);
        order.setDiscountAmount(discount.amount());
        order.setCouponCode(discount.appliedCode());
        order.setTotalAmount(Math.max(0.0, taxableAmount + taxAmount));
        return discount;
    }

    /** Đơn COMPLETED qua CARD/UPI có giá trị > 0 bắt buộc phải có phiên thanh toán hợp lệ. */
    private boolean requiresGatewayPayment(Order order, double totalAmount) {
        return order.getStatus() == OrderStatus.COMPLETED && isGatewayPaymentType(order) && totalAmount > 0;
    }

    private boolean isGatewayPaymentType(Order order) {
        return order.getPaymentType() == PaymentType.CARD || order.getPaymentType() == PaymentType.UPI;
    }

    private void consumePaymentSession(Order order, String sessionId, Long storeId,
                                       double amount, Long orderId) {
        PaymentSessionDTO verified = paymentGatewayService.verifyAndConsumePosOrderPayment(
                sessionId, storeId, amount, orderId);
        if (verified != null) {
            order.setPaymentSessionId(verified.getSessionId());
            order.setPaymentTransactionId(verified.getTransactionId());
        }
    }

    private Order saveAndLinkSession(Order order, String sessionId) {
        Order savedOrder = orderRepository.save(order);
        if (sessionId != null) {
            paymentGatewayService.linkOrderToSession(sessionId, savedOrder.getId());
            // Nếu session đã SUCCESS sẵn tại thời điểm link (webhook đến cực nhanh), nạp lại trạng thái đơn mới nhất
            savedOrder = orderRepository.findById(savedOrder.getId()).orElse(savedOrder);
        }
        return savedOrder;
    }

    // =========================================================================
    // CẬP NHẬT TRẠNG THÁI ĐƠN
    // =========================================================================

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
        return updateOrderStatus(id, status, null, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public OrderDTO updateOrderStatus(
            Long id,
            OrderStatus status,
            PaymentType paymentType,
            String paymentSessionId
    ) throws Exception {
        if (status == null) {
            throw new IllegalArgumentException("Order status is required");
        }
        Order order = orderRepository.findByIdWithLock(id).orElseThrow(
                () -> new Exception("Order not found with id " + id)
        );
        assertCanChangeStatus(order, status);

        OrderStatus current = order.getStatus();
        assertValidTransition(current, status);

        boolean paymentInfoProvided = paymentType != null || trimToNull(paymentSessionId) != null;
        if (current == OrderStatus.PENDING) {
            applyPendingPaymentInfo(order, paymentType, paymentSessionId);
        }

        if (current == status) {
            if (current == OrderStatus.PENDING && paymentInfoProvided) {
                order = orderRepository.save(order);
            }
            return OrderMapper.toDTO(order);
        }

        if (status == OrderStatus.CANCELLED) {
            cancelOrder(order, current);
        } else if (current == OrderStatus.PENDING && status == OrderStatus.COMPLETED) {
            completePendingOrder(order);
        }

        order.setStatus(status);
        return OrderMapper.toDTO(orderRepository.save(order));
    }

    /**
     * Cho phép Thu ngân (hoặc Quản lý chi nhánh) cập nhật trạng thái đơn đang PENDING
     * (hoàn tất hoặc hủy khi đóng hộp thoại thanh toán); hủy đơn COMPLETED hoặc thay đổi khác chỉ dành cho Branch Manager.
     */
    private void assertCanChangeStatus(Order order, OrderStatus target) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (order.getStatus() == OrderStatus.PENDING
                && (target == OrderStatus.COMPLETED || target == OrderStatus.CANCELLED)) {
            if (currentUser.getRole() != UserRole.ROLE_CASHIER
                    && currentUser.getRole() != UserRole.ROLE_BRANCH_MANAGER) {
                throw new AccessDeniedException("Chỉ Thu ngân hoặc Quản lý chi nhánh mới có quyền xử lý đơn chờ thanh toán.");
            }
            accessControl.assertCanAccessBranch(currentUser, order.getBranch());
        } else {
            if (currentUser.getRole() != UserRole.ROLE_BRANCH_MANAGER) {
                throw new AccessDeniedException("Chỉ Quản lý chi nhánh (Branch Manager) mới có quyền hủy hoặc thay đổi trạng thái đơn hàng này.");
            }
            accessControl.assertCanManageBranch(currentUser, order.getBranch());
        }
    }

    private void assertValidTransition(OrderStatus current, OrderStatus target) {
        if (current == OrderStatus.REFUNDED || current == OrderStatus.CANCELLED) {
            throw new IllegalStateException("Order is already " + current + " and its status can no longer be changed");
        }
        if (target == OrderStatus.REFUNDED || target == OrderStatus.PARTIALLY_REFUNDED) {
            throw new IllegalArgumentException("Use the refund function to refund an order");
        }
        if (current == OrderStatus.PARTIALLY_REFUNDED && target == OrderStatus.CANCELLED) {
            throw new IllegalStateException("This order already has partial refunds. Please refund the remaining amount instead of cancelling it");
        }
        if ((current == OrderStatus.COMPLETED || current == OrderStatus.PARTIALLY_REFUNDED)
                && target == OrderStatus.PENDING) {
            throw new IllegalStateException("A completed order cannot be reverted back to PENDING");
        }
    }

    private void applyPendingPaymentInfo(Order order, PaymentType paymentType, String paymentSessionId) {
        if (paymentType != null) {
            order.setPaymentType(paymentType);
        }
        String sessionId = trimToNull(paymentSessionId);
        if (sessionId != null) {
            order.setPaymentSessionId(sessionId);
        }
    }

    /** Hủy đơn: hoàn kho và hoàn/thu hồi điểm tùy theo đơn đã từng tích điểm hay chưa. */
    private void cancelOrder(Order order, OrderStatus current) {
        if (!refundRepository.findByOrderId(order.getId()).isEmpty()) {
            throw new IllegalStateException("This order already has refunds. Please refund the remaining amount instead of cancelling it");
        }
        inventoryCoordinator.restoreRemainingForOrder(order, Collections.emptyList());
        if (current == OrderStatus.COMPLETED || current == null) {
            loyaltyService.revertRemaining(order, Collections.emptyList());
        } else {
            loyaltyService.restoreUsedPoints(order);
        }
    }

    /** Hoàn tất đơn PENDING: xác minh phiên thanh toán (CARD/UPI), cộng điểm và ghi nhận thời điểm thanh toán. */
    private void completePendingOrder(Order order) {
        double totalAmt = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
        if (isGatewayPaymentType(order) && totalAmt > 0) {
            String sessionToVerify = order.getPaymentSessionId();
            if (sessionToVerify == null || sessionToVerify.isBlank()) {
                throw new AccessDeniedException(
                        "Đơn hàng chờ thanh toán QR/Thẻ chưa gắn phiên giao dịch hoặc chưa nhận được xác nhận tiền từ cổng thanh toán."
                );
            }
            consumePaymentSession(order, sessionToVerify, storeIdOf(order.getBranch()), totalAmt, order.getId());
        }
        loyaltyService.awardOnCompletion(order, totalAmt);
        order.setPaidAt(LocalDateTime.now());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int cancelExpiredPendingOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        List<Order> expiredPending = orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.PENDING, cutoff);
        int cancelledCount = 0;
        for (Order candidate : expiredPending) {
            try {
                if (cancelExpiredOrder(candidate.getId())) {
                    cancelledCount++;
                }
            } catch (Exception e) {
                log.warn("Could not auto-cancel expired PENDING order {}: {}", candidate.getId(), e.getMessage());
            }
        }
        if (cancelledCount > 0) {
            log.info("Auto-cancelled {} expired unpaid PENDING order(s) older than 30 minutes and restored inventory", cancelledCount);
        }
        return cancelledCount;
    }

    /** @return true nếu đơn thực sự bị hủy. */
    private boolean cancelExpiredOrder(Long orderId) {
        Order order = orderRepository.findByIdWithLock(orderId).orElse(null);
        if (order == null || order.getStatus() != OrderStatus.PENDING) {
            return false;
        }
        // Nếu phiên thanh toán thực chất đã SUCCESS thì tự hoàn tất thay vì hủy
        if (order.getPaymentSessionId() != null && !order.getPaymentSessionId().isBlank()) {
            PaymentSessionDTO session = paymentGatewayService.getRawSession(order.getPaymentSessionId());
            if (session != null && "SUCCESS".equalsIgnoreCase(session.getStatus())) {
                paymentGatewayService.linkOrderToSession(order.getPaymentSessionId(), order.getId());
                return false;
            }
        }
        inventoryCoordinator.restoreRemainingForOrder(order, Collections.emptyList());
        loyaltyService.restoreUsedPoints(order);
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        return true;
    }

    // =========================================================================
    // TRA CỨU & XÓA ĐƠN
    // =========================================================================

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
        Store orderStore = order.getBranch() != null ? order.getBranch().getStore()
                : (order.getCustomer() != null ? order.getCustomer().getStore()
                : accessControl.resolveStoreOfUser(order.getCashier()));
        accessControl.assertStoreLevelOrAdmin(userService.getCurrentUser(), orderStore);

        List<Refund> orderRefunds = refundRepository.findByOrderId(id);
        revertSideEffectsBeforeDelete(order, orderRefunds);

        for (Refund r : orderRefunds) {
            r.setOrder(null);
            refundRepository.save(r);
        }
        orderRepository.delete(order);
    }

    private void revertSideEffectsBeforeDelete(Order order, List<Refund> orderRefunds) {
        // Đơn REFUNDED đã hoàn kho & hoàn điểm 100%, đơn CANCELLED đã hoàn kho & điểm khi hủy -> không hoàn lần nữa
        OrderStatus status = order.getStatus();
        if (status == OrderStatus.REFUNDED || status == OrderStatus.CANCELLED) {
            return;
        }
        inventoryCoordinator.restoreRemainingForOrder(order, orderRefunds);
        if (status == OrderStatus.COMPLETED || status == OrderStatus.PARTIALLY_REFUNDED || status == null) {
            // Thu hồi đầy đủ phần điểm thưởng còn lại kể cả khi đơn đã từng hoàn tiền một phần (Partial Refund)
            loyaltyService.revertRemaining(order, orderRefunds);
        } else {
            loyaltyService.restoreUsedPoints(order);
        }
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

    // =========================================================================
    // TIỆN ÍCH
    // =========================================================================

    private static String trimToNull(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private static Long storeIdOf(Branch branch) {
        return branch != null && branch.getStore() != null ? branch.getStore().getId() : null;
    }
}
