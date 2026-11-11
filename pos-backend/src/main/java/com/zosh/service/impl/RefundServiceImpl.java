package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.UserRole;
import com.zosh.mapper.RefundMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.dto.RefundItemDTO;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.RefundService;
import com.zosh.service.UserService;
import com.zosh.service.order.CustomerLoyaltyService;
import com.zosh.service.order.OrderInventoryCoordinator;
import com.zosh.service.order.ReturnedQuantityCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefundServiceImpl implements RefundService {

    private static final double AMOUNT_TOLERANCE = 0.01;
    private static final double ROUNDING_TOLERANCE = 10.0;

    private final UserService userService;
    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final AccessControlService accessControl;
    private final OrderInventoryCoordinator inventoryCoordinator;
    private final CustomerLoyaltyService loyaltyService;

    /** Kết quả tính toán một lần hoàn: các dòng hàng hoàn, số lượng cộng kho, số tiền hoàn. */
    private static final class RefundPlan {
        final List<RefundItem> items = new ArrayList<>();
        // TreeMap giữ thứ tự productId tăng dần chống deadlock
        final Map<Long, Integer> stockToRestoreByProduct = new TreeMap<>();
        double amount;
        boolean returningAllRemainingItems;
    }

    /** Ngữ cảnh số liệu của đơn tại thời điểm hoàn tiền. */
    private record OrderRefundContext(
            Order order,
            List<OrderItem> orderItems,
            Map<Long, Integer> remainingQtyByOrderItemId,
            double orderTotal,
            double alreadyRefunded,
            double remainingRefundable,
            double netOrderFactor
    ) {
    }

    // =========================================================================
    // TẠO PHIẾU HOÀN
    // =========================================================================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RefundDTO createRefund(RefundDTO refund) throws Exception {
        if (refund == null || refund.getOrderId() == null) {
            throw new IllegalArgumentException("Order ID is required for refund");
        }
        User cashier = userService.getCurrentUser();
        if (cashier.getRole() != UserRole.ROLE_CASHIER) {
            throw new AccessDeniedException("Chỉ Thu ngân (ROLE_CASHIER) có ca đang mở mới được phép tạo phiếu hoàn tiền tại quầy.");
        }
        Order order = orderRepository.findByIdWithLock(refund.getOrderId()).orElseThrow(
                () -> new Exception("Order not found with id: " + refund.getOrderId())
        );
        accessControl.assertCanAccessBranch(cashier, order.getBranch());
        if (refund.getBranchId() != null && order.getBranch() != null
                && !refund.getBranchId().equals(order.getBranch().getId())) {
            throw new IllegalArgumentException("Refund branch does not match order branch");
        }
        assertOrderRefundable(order);

        ShiftReport activeShift = resolveActiveShift(cashier);
        if (activeShift == null) {
            throw new Exception("Vui lòng bắt đầu ca làm việc (Start Shift) trước khi thực hiện hoàn tiền.");
        }

        OrderRefundContext ctx = buildRefundContext(order, refundRepository.findByOrderId(order.getId()));
        boolean hasRequestedItems = refund.getItems() != null && !refund.getItems().isEmpty();
        RefundPlan plan = hasRequestedItems
                ? planItemizedRefund(ctx, refund)
                : planAmountBasedRefund(ctx, refund.getAmount());
        if (plan.amount <= 0) {
            throw new IllegalArgumentException("Refund amount must be greater than 0");
        }

        // Cộng trả kho NGAY LẬP TỨC theo đúng số lượng sản phẩm khách trả trong lần hoàn tiền này
        Branch branch = order.getBranch();
        if (branch != null && !plan.stockToRestoreByProduct.isEmpty()) {
            inventoryCoordinator.restoreByProduct(plan.stockToRestoreByProduct, branch.getId(), order.getId());
        }

        double totalRefundedAfter = ctx.alreadyRefunded() + plan.amount;
        boolean isFullRefund = totalRefundedAfter >= ctx.orderTotal() - AMOUNT_TOLERANCE;
        order.setStatus(isFullRefund ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED);
        orderRepository.save(order);

        PaymentType paymentType = refund.getPaymentType() != null ? refund.getPaymentType() : order.getPaymentType();
        String normalizedReason = refund.getReason() != null && !refund.getReason().isBlank()
                ? refund.getReason().trim() : refund.getReason();
        Refund createdRefund = buildRefundEntity(order, cashier, activeShift, normalizedReason, paymentType, plan);

        // Thu hồi & hoàn trả điểm tích lũy của khách hàng khi hoàn tiền
        loyaltyService.applyForRefund(order, ctx.orderTotal(), ctx.alreadyRefunded(), totalRefundedAfter,
                isFullRefund || plan.returningAllRemainingItems);

        return RefundMapper.toDTO(refundRepository.save(createdRefund));
    }

    private void assertOrderRefundable(Order order) throws Exception {
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new Exception("A cancelled order cannot be refunded");
        }
        if (order.getStatus() == OrderStatus.PENDING) {
            throw new Exception("A pending unpaid order cannot be refunded. Cancel it instead.");
        }
        if (order.getStatus() == OrderStatus.REFUNDED) {
            throw new Exception("This order has already been fully refunded");
        }
    }

    /** Thu ngân (ROLE_CASHIER) bắt buộc dùng ca đang mở của chính mình. */
    private ShiftReport resolveActiveShift(User cashier) {
        return findOpenShiftOf(cashier);
    }

    private ShiftReport findOpenShiftOf(User user) {
        return shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(user).orElse(null);
    }

    private OrderRefundContext buildRefundContext(Order order, List<Refund> existingRefunds) throws Exception {
        double alreadyRefunded = sumAmounts(existingRefunds);
        double orderTotal = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
        double orderSubTotal = order.getSubTotal() != null && order.getSubTotal() > 0 ? order.getSubTotal() : orderTotal;
        double netOrderFactor = orderSubTotal > 0 ? (orderTotal / orderSubTotal) : 1.0;
        double remainingRefundable = Math.max(0.0, orderTotal - alreadyRefunded);
        if (remainingRefundable < AMOUNT_TOLERANCE) {
            throw new Exception("This order has already been refunded");
        }

        // Số lượng từng OrderItem còn có thể hoàn sau các lần Partial Refund trước đó
        List<OrderItem> orderItems = order.getItems() != null ? order.getItems() : Collections.emptyList();
        int[] remaining = ReturnedQuantityCalculator.remainingQuantities(orderItems, existingRefunds);
        Map<Long, Integer> remainingQtyByOrderItemId = new LinkedHashMap<>();
        for (int i = 0; i < orderItems.size(); i++) {
            remainingQtyByOrderItemId.put(orderItems.get(i).getId(), remaining[i]);
        }
        return new OrderRefundContext(order, orderItems, remainingQtyByOrderItemId,
                orderTotal, alreadyRefunded, remainingRefundable, netOrderFactor);
    }

    /** Hoàn trả theo danh sách sản phẩm cụ thể (hỗ trợ cả Partial Refund lẫn Full Refund). */
    private RefundPlan planItemizedRefund(OrderRefundContext ctx, RefundDTO refund) throws Exception {
        Map<Long, Integer> requestedByOrderItemId = collectRequestedQuantities(ctx, refund.getItems());

        RefundPlan plan = new RefundPlan();
        plan.returningAllRemainingItems = ctx.orderItems().stream().allMatch(oi ->
                requestedByOrderItemId.getOrDefault(oi.getId(), 0)
                        >= ctx.remainingQtyByOrderItemId().getOrDefault(oi.getId(), 0));

        double computedItemsNetAmount = 0.0;
        for (OrderItem oi : ctx.orderItems()) {
            int returningNow = requestedByOrderItemId.getOrDefault(oi.getId(), 0);
            if (returningNow <= 0) continue;
            computedItemsNetAmount += addRefundLine(plan, oi, returningNow, ctx.netOrderFactor());
        }
        double itemsNetValue = round2(computedItemsNetAmount);
        plan.amount = resolveItemizedAmount(refund.getAmount(), itemsNetValue, ctx.remainingRefundable(),
                plan.returningAllRemainingItems);
        reconcileRoundingDelta(plan, itemsNetValue, refund.getAmount(), ctx.remainingRefundable());
        return plan;
    }

    /** Ghép từng dòng yêu cầu với OrderItem tương ứng và chặn hoàn vượt số lượng còn lại. */
    private Map<Long, Integer> collectRequestedQuantities(OrderRefundContext ctx, List<RefundItemDTO> requestedItems) {
        Map<Long, Integer> requestedByOrderItemId = new LinkedHashMap<>();
        for (RefundItemDTO reqItem : requestedItems) {
            if (reqItem == null || reqItem.getQuantity() == null || reqItem.getQuantity() <= 0) {
                continue;
            }
            OrderItem matchedOi = findMatchingOrderItem(ctx.orderItems(), reqItem,
                    ctx.remainingQtyByOrderItemId(), requestedByOrderItemId);
            if (matchedOi == null) {
                throw new IllegalArgumentException("Returned item does not belong to order #" + ctx.order().getId()
                        + " or has no remaining returnable quantity");
            }
            int maxLeft = ctx.remainingQtyByOrderItemId().getOrDefault(matchedOi.getId(), 0)
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
        return requestedByOrderItemId;
    }

    private double resolveItemizedAmount(Double requestedAmount, double itemsNetValue,
                                         double remainingRefundable, boolean returningAll) throws Exception {
        if (requestedAmount != null) {
            if (requestedAmount <= 0) {
                throw new IllegalArgumentException("Refund amount must be greater than 0");
            }
            // Ưu tiên số tiền do thu ngân nhập (vd: trừ phí trả hàng) kể cả khi khách trả hết hàng còn lại
            if (requestedAmount > remainingRefundable + ROUNDING_TOLERANCE) {
                throw new Exception("Refund amount (" + requestedAmount + ") exceeds remaining refundable order total (" + remainingRefundable + ")");
            }
            // Trả MỘT PHẦN hàng thì không được hoàn nhiều hơn giá trị số hàng thực trả
            // (chừa biên độ làm tròn cho các đơn có VAT/chiết khấu tỷ lệ)
            double maxAllowedForPartial = itemsNetValue + Math.max(ROUNDING_TOLERANCE, round2(itemsNetValue * 0.001));
            if (!returningAll && requestedAmount > maxAllowedForPartial) {
                throw new IllegalArgumentException("Refund amount (" + requestedAmount
                        + ") exceeds the value of the returned items (" + itemsNetValue + ")");
            }
            return round2(Math.min(requestedAmount, remainingRefundable));
        }
        if (returningAll) {
            return round2(remainingRefundable);
        }
        if (itemsNetValue > remainingRefundable && itemsNetValue <= remainingRefundable + ROUNDING_TOLERANCE) {
            return round2(remainingRefundable);
        }
        if (remainingRefundable - itemsNetValue > 0 && remainingRefundable - itemsNetValue <= AMOUNT_TOLERANCE) {
            return round2(remainingRefundable);
        }
        return round2(Math.min(itemsNetValue, remainingRefundable));
    }

    /** Hấp thụ phần chênh lệch làm tròn thuần túy (<= ROUNDING_TOLERANCE) vào dòng cuối để SUM(items.refundAmount) khớp Refund.amount. */
    private void reconcileRoundingDelta(RefundPlan plan, double itemsNetValue,
                                        Double requestedAmount, double remainingRefundable) {
        if (plan.items.isEmpty()) {
            return;
        }
        double delta = round2(plan.amount - itemsNetValue);
        if (Math.abs(delta) <= 0 || Math.abs(delta) > ROUNDING_TOLERANCE) {
            return;
        }
        boolean autoCalculatedRounding = requestedAmount == null;
        boolean snappedToRemaining = requestedAmount != null
                && Math.abs(plan.amount - remainingRefundable) <= AMOUNT_TOLERANCE;
        if (!autoCalculatedRounding && !snappedToRemaining) {
            return;
        }
        RefundItem last = plan.items.get(plan.items.size() - 1);
        double adjusted = round2((last.getRefundAmount() != null ? last.getRefundAmount() : 0.0) + delta);
        if (adjusted >= 0) {
            last.setRefundAmount(adjusted);
        }
    }

    /**
     * Không truyền danh sách items: cho phép hoàn tiền theo SỐ TIỀN (hoàn một phần hoặc toàn phần).
     * Hoàn một phần theo số tiền không đổi tồn kho; chỉ khi tổng tiền hoàn đạt 100% đơn mới cộng trả phần hàng còn lại.
     */
    private RefundPlan planAmountBasedRefund(OrderRefundContext ctx, Double requestedAmount) throws Exception {
        RefundPlan plan = new RefundPlan();
        if (requestedAmount != null && requestedAmount <= 0) {
            throw new IllegalArgumentException("Refund amount must be greater than 0");
        }
        double rawAmount = requestedAmount != null ? requestedAmount : ctx.remainingRefundable();
        if (rawAmount > ctx.remainingRefundable() + ROUNDING_TOLERANCE) {
            throw new Exception(
                    "Refund amount (" + rawAmount + ") exceeds remaining refundable order total (" + ctx.remainingRefundable() + ")");
        }
        plan.amount = round2(Math.min(rawAmount, ctx.remainingRefundable()));
        if (plan.amount <= 0) {
            throw new IllegalArgumentException("Refund amount must be greater than 0");
        }

        boolean reachesFullOrder = (ctx.alreadyRefunded() + plan.amount) >= (ctx.orderTotal() - AMOUNT_TOLERANCE);
        if (reachesFullOrder) {
            // Hoàn nốt phần còn lại của đơn -> chỉ cộng trả số lượng sản phẩm CHƯA từng được hoàn kho trước đó!
            for (OrderItem oi : ctx.orderItems()) {
                int remainingQty = ctx.remainingQtyByOrderItemId().getOrDefault(oi.getId(), 0);
                if (remainingQty > 0) {
                    addRefundLine(plan, oi, remainingQty, ctx.netOrderFactor());
                }
            }
        }
        return plan;
    }

    /** Thêm một dòng hàng hoàn vào plan (kèm số lượng cộng kho) và trả về số tiền của dòng. */
    private double addRefundLine(RefundPlan plan, OrderItem oi, int qty, double netOrderFactor) {
        double netUnitPrice = rawUnitPrice(oi) * netOrderFactor;
        double lineRefundAmount = round2(netUnitPrice * qty);

        Long prodId = oi.getProduct() != null ? oi.getProduct().getId() : null;
        String prodName = oi.getProduct() != null ? oi.getProduct().getName() : "Deleted Product";
        if (prodId != null) {
            plan.stockToRestoreByProduct.merge(prodId, qty, Integer::sum);
        }
        plan.items.add(RefundItem.builder()
                .orderItemId(oi.getId())
                .productId(prodId)
                .productName(prodName)
                .quantity(qty)
                .unitPrice(round2(netUnitPrice))
                .refundAmount(lineRefundAmount)
                .build());
        return lineRefundAmount;
    }

    private double rawUnitPrice(OrderItem oi) {
        int orderedQty = oi.getQuantity() != null && oi.getQuantity() > 0 ? oi.getQuantity() : 1;
        if (oi.getPrice() != null) {
            return oi.getPrice() / orderedQty;
        }
        return oi.getProduct() != null && oi.getProduct().getSellingPrice() != null
                ? oi.getProduct().getSellingPrice() : 0.0;
    }

    private Refund buildRefundEntity(Order order, User cashier, ShiftReport shift, String reason,
                                     PaymentType paymentType, RefundPlan plan) {
        Refund createdRefund = Refund.builder()
                .order(order)
                .cashier(cashier)
                .branch(order.getBranch())
                .shiftReport(shift)
                .reason(reason)
                .amount(plan.amount)
                .paymentType(paymentType)
                .createdAt(LocalDateTime.now())
                .build();
        for (RefundItem ri : plan.items) {
            ri.setRefund(createdRefund);
        }
        createdRefund.setItems(plan.items);
        return createdRefund;
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

    // =========================================================================
    // TRA CỨU PHIẾU HOÀN
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<RefundDTO> getAllRefunds() throws Exception {
        User current = userService.getCurrentUser();
        if (current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin không truy cập chứng từ hoàn tiền nội bộ của cửa hàng.");
        }
        List<Refund> scopedRefunds;
        if (current.getRole() == UserRole.ROLE_BRANCH_MANAGER
                || current.getRole() == UserRole.ROLE_CASHIER) {
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
                .filter(r -> accessControl.canAccessBranch(current, r.getBranch()))
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
    public List<RefundDTO> getRefundsByOrderId(Long orderId) throws Exception {
        Order order = orderRepository.findById(orderId).orElseThrow(
                () -> new Exception("Order not found with id: " + orderId)
        );
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), order.getBranch());
        return refundRepository.findByOrderId(orderId).stream()
                .map(RefundMapper::toDTO)
                .collect(Collectors.toList());
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

    // =========================================================================
    // XÓA PHIẾU HOÀN
    // =========================================================================

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

        if (refund.getOrder() != null) {
            revertOrderEffectsOfRefund(refund, refund.getOrder());
        }
        refundRepository.delete(refund);
    }

    /** Đảo ngược tồn kho, trạng thái đơn và điểm tích lũy đã thay đổi khi tạo phiếu hoàn này. */
    private void revertOrderEffectsOfRefund(Refund refund, Order order) throws Exception {
        double refundAmount = refund.getAmount() != null ? refund.getAmount() : 0.0;
        double orderTotal = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
        List<Refund> allOrderRefunds = refundRepository.findByOrderId(order.getId());
        List<Refund> otherRefunds = allOrderRefunds.stream()
                .filter(r -> !r.getId().equals(refund.getId()))
                .collect(Collectors.toList());
        double remainingRefunded = sumAmounts(otherRefunds);
        boolean otherRefundsHaveItems = otherRefunds.stream()
                .anyMatch(r -> r.getItems() != null && !r.getItems().isEmpty());

        boolean orderWasFullyRefunded = order.getStatus() == OrderStatus.REFUNDED;
        boolean reopenOrder = orderWasFullyRefunded && remainingRefunded < orderTotal - AMOUNT_TOLERANCE;

        List<OrderItem> orderItems = order.getItems() != null ? order.getItems() : Collections.emptyList();
        boolean allItemsReturnedBeforeDelete = !orderItems.isEmpty() && Arrays.stream(
                ReturnedQuantityCalculator.remainingQuantities(orderItems, allOrderRefunds)
        ).allMatch(q -> q <= 0);
        boolean allItemsReturnedAfterDelete = !orderItems.isEmpty() && Arrays.stream(
                ReturnedQuantityCalculator.remainingQuantities(orderItems, otherRefunds)
        ).allMatch(q -> q <= 0);
        boolean wasFullyReturnedForLoyalty = orderWasFullyRefunded || allItemsReturnedBeforeDelete;
        boolean stillFullyReturnedForLoyalty = remainingRefunded >= orderTotal - AMOUNT_TOLERANCE
                || allItemsReturnedAfterDelete;
        boolean reverseLoyaltyAsReopened = wasFullyReturnedForLoyalty && !stillFullyReturnedForLoyalty;

        if (order.getBranch() != null) {
            redeductInventory(refund, order, reopenOrder && !otherRefundsHaveItems);
        }
        restoreOrderStatusAfterRefundDelete(order, remainingRefunded, reopenOrder);

        // Đảo ngược điều chỉnh điểm tích lũy đã thực hiện khi tạo khoản hoàn tiền này
        loyaltyService.reverseForDeletedRefund(order, orderTotal, remainingRefunded, refundAmount,
                wasFullyReturnedForLoyalty, reverseLoyaltyAsReopened);
    }

    private void redeductInventory(Refund refund, Order order, boolean legacyFullDeduct) throws Exception {
        if (refund.getItems() != null && !refund.getItems().isEmpty()) {
            // Trừ lại đúng số lượng sản phẩm đã được cộng kho trong lần hoàn tiền này
            Map<Long, Integer> deductByProduct = new TreeMap<>();
            for (RefundItem ri : refund.getItems()) {
                if (ri.getProductId() != null && ri.getQuantity() != null && ri.getQuantity() > 0) {
                    deductByProduct.merge(ri.getProductId(), ri.getQuantity(), Integer::sum);
                }
            }
            inventoryCoordinator.deductByProduct(deductByProduct, order.getBranch().getId());
        } else if (legacyFullDeduct && order.getItems() != null) {
            // Tương thích ngược với các bản ghi Refund cũ chưa có bảng RefundItem
            inventoryCoordinator.deductAllOrderItems(order);
        }
    }

    private void restoreOrderStatusAfterRefundDelete(Order order, double remainingRefunded, boolean reopenOrder) {
        if (remainingRefunded <= AMOUNT_TOLERANCE) {
            if (order.getStatus() == OrderStatus.REFUNDED || order.getStatus() == OrderStatus.PARTIALLY_REFUNDED) {
                order.setStatus(OrderStatus.COMPLETED);
                orderRepository.save(order);
            }
        } else if (reopenOrder) {
            order.setStatus(OrderStatus.PARTIALLY_REFUNDED);
            orderRepository.save(order);
        }
    }

    // =========================================================================
    // TIỆN ÍCH
    // =========================================================================

    private static double sumAmounts(List<Refund> refunds) {
        return refunds.stream().mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0).sum();
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
