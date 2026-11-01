package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PlanFeature;
import com.zosh.modal.Branch;
import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Refund;
import com.zosh.modal.ShiftReport;
import com.zosh.payload.response.*;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.BranchAnalyticsService;
import com.zosh.service.PlanLimitChecker;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BranchAnalyticsServiceImpl implements BranchAnalyticsService {

    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final RefundRepository refundRepository;
    private final BranchRepository branchRepository;
    private final PlanLimitChecker planLimitChecker;
    private final AccessControlService accessControl;

    private Branch resolveAndAssertBranchAccess(Long branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new EntityNotFoundException("Branch not found with id: " + branchId));
        try {
            if (!accessControl.canAccessBranch(accessControl.currentUser(), branch)) {
                throw new AccessDeniedException("You do not have permission to view analytics of this branch");
            }
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException(e.getMessage());
        }
        return branch;
    }

    private boolean isValidRevenueOrder(Order o) {
        return o != null && (o.getStatus() == null || o.getStatus() == OrderStatus.COMPLETED);
    }

    /** Tổng tiền đã hoàn theo từng orderId của chi nhánh (để trừ hoàn tiền một phần khỏi doanh thu thực thu). */
    private Map<Long, Double> getRefundedMapByBranch(Long branchId) {
        return refundRepository.findByBranchId(branchId).stream()
                .filter(r -> r.getOrder() != null && r.getOrder().getId() != null)
                .collect(Collectors.groupingBy(
                        r -> r.getOrder().getId(),
                        Collectors.summingDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                ));
    }

    /** Doanh thu thực thu của đơn = tổng tiền đơn trừ tiền đã hoàn (một phần) trên đơn đó. */
    private double netOrderAmount(Order order, Map<Long, Double> refundedByOrderId) {
        if (order == null) {
            return 0.0;
        }
        double gross = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
        double refunded = (refundedByOrderId != null && order.getId() != null)
                ? refundedByOrderId.getOrDefault(order.getId(), 0.0)
                : 0.0;
        return Math.max(0.0, gross - refunded);
    }

    /**
     * Phân bổ doanh thu thực nhận của từng OrderItem theo tỷ lệ (doanh thu thực thu của đơn / order.subTotal)
     * để phản ánh đầy đủ chiết khấu đơn hàng (discountAmount / coupon / điểm thưởng), thuế (taxAmount) và hoàn tiền một phần.
     */
    private double effectiveItemNetRevenue(Order order, OrderItem item, Map<Long, Double> refundedByOrderId) {
        double rawItemPrice = item.getPrice() != null ? item.getPrice() : 0.0;
        if (order == null || rawItemPrice <= 0) {
            return 0.0;
        }
        double subTotal = order.getSubTotal() != null ? order.getSubTotal() : 0.0;
        if (subTotal > 0) {
            return rawItemPrice * (netOrderAmount(order, refundedByOrderId) / subTotal);
        }
        return rawItemPrice;
    }

    @Override
    public List<DailySalesDTO> getDailySalesChart(Long branchId, int days) {
        resolveAndAssertBranchAccess(branchId);
        int safeDays = Math.max(1, days);
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(safeDays - 1);
        LocalDateTime rangeStart = startDate.atStartOfDay();
        LocalDateTime rangeEnd = today.plusDays(1).atStartOfDay();

        List<Order> ordersInRange = orderRepository.findByBranchIdAndCreatedAtBetween(branchId, rangeStart, rangeEnd)
                .stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());

        Map<LocalDate, List<Order>> ordersByDate = ordersInRange.stream()
                .filter(o -> o.getCreatedAt() != null)
                .collect(Collectors.groupingBy(o -> o.getCreatedAt().toLocalDate()));

        List<DailySalesDTO> result = new ArrayList<>();
        for (int i = safeDays - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            List<Order> dayOrders = ordersByDate.getOrDefault(date, Collections.emptyList());
            double total = dayOrders.stream()
                    .mapToDouble(o -> netOrderAmount(o, refundedMap))
                    .sum();
            result.add(new DailySalesDTO(date.toString(), total, dayOrders.size()));
        }
        return result;
    }

    @Override
    public List<TopProductDTO> getTopProductsByQuantity(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        List<Order> allOrders = orderRepository.findByBranchId(branchId).stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());
        Map<Long, double[]> productStats = new HashMap<>();
        Map<Long, String[]> productMeta = new HashMap<>();
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);

        for (Order order : allOrders) {
            if (order.getItems() == null) continue;
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() == null) continue;
                Long pid = item.getProduct().getId();
                productStats.computeIfAbsent(pid, k -> new double[]{0, 0});
                productStats.get(pid)[0] += item.getQuantity() != null ? item.getQuantity() : 0;
                productStats.get(pid)[1] += effectiveItemNetRevenue(order, item, refundedMap);
                productMeta.put(pid, new String[]{item.getProduct().getName(), item.getProduct().getSku()});
            }
        }

        long totalQty = productStats.values().stream().mapToLong(v -> (long) v[0]).sum();

        return productStats.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .limit(5)
                .map(e -> {
                    Long pid = e.getKey();
                    long qty = (long) e.getValue()[0];
                    double rev = Math.round(e.getValue()[1] * 100.0) / 100.0;
                    double pct = totalQty == 0 ? 0 : (qty * 100.0 / totalQty);
                    String[] meta = productMeta.getOrDefault(pid, new String[]{"Unknown", ""});
                    return new TopProductDTO(pid, meta[0], meta[1], qty, rev, Math.round(pct * 10) / 10.0);
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<TopCashierDTO> getTopCashiersByRevenue(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        List<Order> allOrders = orderRepository.findByBranchId(branchId).stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());
        Map<Long, double[]> cashierStats = new HashMap<>();
        Map<Long, String> cashierNames = new HashMap<>();
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);

        for (Order order : allOrders) {
            if (order.getCashier() == null) continue;
            Long cid = order.getCashier().getId();
            cashierStats.computeIfAbsent(cid, k -> new double[]{0, 0});
            cashierStats.get(cid)[0] += netOrderAmount(order, refundedMap);
            cashierStats.get(cid)[1]++;
            cashierNames.put(cid, order.getCashier().getFullName());
        }

        return cashierStats.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .limit(5)
                .map(e -> new TopCashierDTO(e.getKey(), cashierNames.getOrDefault(e.getKey(), "Unknown"),
                        e.getValue()[0], (int) e.getValue()[1]))
                .collect(Collectors.toList());
    }

    @Override
    public List<CategorySalesDTO> getCategoryWiseSalesBreakdown(Long branchId, LocalDate date) throws Exception {
        Branch branch = resolveAndAssertBranchAccess(branchId);
        planLimitChecker.requireFeature(branch.getStore(), PlanFeature.ADVANCED_REPORTS);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        LocalDateTime start = targetDate.atStartOfDay();
        LocalDateTime end = targetDate.plusDays(1).atStartOfDay();
        List<Order> orders = orderRepository.findByBranchIdAndCreatedAtBetween(branchId, start, end).stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());

        Map<String, double[]> categoryStats = new HashMap<>();
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);
        for (Order order : orders) {
            if (order.getItems() == null) continue;
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() == null) continue;
                String cat = (item.getProduct().getCategory() != null && item.getProduct().getCategory().getName() != null)
                        ? item.getProduct().getCategory().getName()
                        : "Uncategorized";
                categoryStats.computeIfAbsent(cat, k -> new double[]{0, 0});
                categoryStats.get(cat)[0] += item.getQuantity() != null ? item.getQuantity() : 0;
                categoryStats.get(cat)[1] += effectiveItemNetRevenue(order, item, refundedMap);
            }
        }

        double totalRevenue = categoryStats.values().stream().mapToDouble(v -> v[1]).sum();

        return categoryStats.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[1], a.getValue()[1]))
                .map(e -> {
                    double rev = Math.round(e.getValue()[1] * 100.0) / 100.0;
                    double pct = totalRevenue == 0 ? 0 : (e.getValue()[1] * 100.0 / totalRevenue);
                    return new CategorySalesDTO(e.getKey(), (long) e.getValue()[0], rev,
                            Math.round(pct * 10) / 10.0);
                })
                .collect(Collectors.toList());
    }

    @Override
    public BranchOverviewDTO getTodayOverview(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();

        List<Order> todayOrders = orderRepository.findByBranchIdAndCreatedAtBetween(branchId, start, end).stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());
        Set<Long> todayCompletedIds = todayOrders.stream()
                .map(Order::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Refund> branchRefunds = refundRepository.findByBranchId(branchId);
        double partialRefundsOnTodayCompleted = branchRefunds.stream()
                .filter(r -> r.getOrder() != null && todayCompletedIds.contains(r.getOrder().getId()))
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();

        double todayGrossRevenue = todayOrders.stream().mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();
        double todayRevenue = Math.max(0.0, todayGrossRevenue - partialRefundsOnTodayCompleted);
        double avgOrderValue = todayOrders.isEmpty() ? 0 : todayRevenue / todayOrders.size();

        double todayRefunds = branchRefunds.stream()
                .filter(r -> r.getCreatedAt() != null && !r.getCreatedAt().isBefore(start) && r.getCreatedAt().isBefore(end))
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();

        List<ShiftReport> branchShifts = shiftReportRepository.findByBranchId(branchId);
        long activeShifts = branchShifts.stream()
                .filter(s -> s.getShiftEnd() == null && s.getShiftStart() != null)
                .count();

        long lowStock = inventoryRepository.findByBranchId(branchId).stream()
                .filter(inv -> inv.getQuantity() != null && inv.getMinStockLevel() != null && inv.getQuantity() <= inv.getMinStockLevel())
                .count();

        return new BranchOverviewDTO(
                todayRevenue,
                todayOrders.size(),
                todayRefunds,
                (int) activeShifts,
                (int) lowStock,
                Math.round(avgOrderValue * 100) / 100.0
        );
    }

    @Override
    public List<PaymentBreakdownDTO> getPaymentBreakdown(Long branchId, LocalDate date) {
        resolveAndAssertBranchAccess(branchId);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        LocalDateTime start = targetDate.atStartOfDay();
        LocalDateTime end = targetDate.plusDays(1).atStartOfDay();
        List<Order> orders = orderRepository.findByBranchIdAndCreatedAtBetween(branchId, start, end).stream()
                .filter(this::isValidRevenueOrder)
                .collect(Collectors.toList());

        Map<String, double[]> paymentStats = new HashMap<>();
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);
        for (Order order : orders) {
            String pt = order.getPaymentType() != null ? order.getPaymentType().name() : "CASH";
            paymentStats.computeIfAbsent(pt, k -> new double[]{0, 0});
            paymentStats.get(pt)[0]++;
            paymentStats.get(pt)[1] += netOrderAmount(order, refundedMap);
        }

        double totalAmount = paymentStats.values().stream().mapToDouble(v -> v[1]).sum();

        return paymentStats.entrySet().stream()
                .map(e -> {
                    double pct = totalAmount == 0 ? 0 : (e.getValue()[1] * 100.0 / totalAmount);
                    return new PaymentBreakdownDTO(e.getKey(), (long) e.getValue()[0], e.getValue()[1],
                            Math.round(pct * 10) / 10.0);
                })
                .collect(Collectors.toList());
    }
}
