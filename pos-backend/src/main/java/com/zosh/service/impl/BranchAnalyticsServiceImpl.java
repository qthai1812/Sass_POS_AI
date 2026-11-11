package com.zosh.service.impl;

import com.zosh.domain.PlanFeature;
import com.zosh.modal.Branch;
import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Refund;
import com.zosh.modal.ShiftReport;
import com.zosh.payload.response.*;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.BranchAnalyticsService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.analytics.AnalyticsCalculationHelper;
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
    private final AnalyticsCalculationHelper calcHelper;

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

    private Map<Long, Double> getRefundedMapByBranch(Long branchId) {
        return calcHelper.buildRefundedMapByOrder(refundRepository.findByBranchId(branchId));
    }

    @Override
    public List<DailySalesDTO> getDailySalesChart(Long branchId, int days) {
        resolveAndAssertBranchAccess(branchId);
        int safeDays = Math.max(1, days);
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(safeDays - 1);

        List<Order> ordersInRange = calcHelper.filterRevenueOrders(
                orderRepository.findByBranchIdAndCreatedAtBetween(
                        branchId, startDate.atStartOfDay(), today.plusDays(1).atStartOfDay()
                )
        );
        return calcHelper.buildDailySalesSeries(ordersInRange, refundedMap, today, safeDays);
    }

    @Override
    public List<TopProductDTO> getTopProductsByQuantity(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        List<Order> allOrders = calcHelper.filterRevenueOrders(orderRepository.findByBranchId(branchId));
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);

        Map<Long, double[]> productStats = new HashMap<>();
        Map<Long, String[]> productMeta = new HashMap<>();
        for (Order order : allOrders) {
            if (order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() == null) {
                    continue;
                }
                Long pid = item.getProduct().getId();
                productStats.computeIfAbsent(pid, k -> new double[]{0, 0});
                productStats.get(pid)[0] += item.getQuantity() != null ? item.getQuantity() : 0;
                productStats.get(pid)[1] += calcHelper.effectiveItemNetRevenue(order, item, refundedMap);
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
                    double rev = calcHelper.round2(e.getValue()[1]);
                    double pct = totalQty == 0 ? 0 : (qty * 100.0 / totalQty);
                    String[] meta = productMeta.getOrDefault(pid, new String[]{"Unknown", ""});
                    return new TopProductDTO(pid, meta[0], meta[1], qty, rev, calcHelper.round1(pct));
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<TopCashierDTO> getTopCashiersByRevenue(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        List<Order> allOrders = calcHelper.filterRevenueOrders(orderRepository.findByBranchId(branchId));
        Map<Long, Double> refundedMap = getRefundedMapByBranch(branchId);

        Map<Long, double[]> cashierStats = new HashMap<>();
        Map<Long, String> cashierNames = new HashMap<>();
        for (Order order : allOrders) {
            if (order.getCashier() == null) {
                continue;
            }
            Long cid = order.getCashier().getId();
            cashierStats.computeIfAbsent(cid, k -> new double[]{0, 0});
            cashierStats.get(cid)[0] += calcHelper.netOrderAmount(order, refundedMap);
            cashierStats.get(cid)[1]++;
            cashierNames.put(cid, order.getCashier().getFullName());
        }

        return cashierStats.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .limit(5)
                .map(e -> new TopCashierDTO(
                        e.getKey(),
                        cashierNames.getOrDefault(e.getKey(), "Unknown"),
                        e.getValue()[0],
                        (int) e.getValue()[1]
                ))
                .collect(Collectors.toList());
    }

    @Override
    public List<CategorySalesDTO> getCategoryWiseSalesBreakdown(Long branchId, LocalDate date) throws Exception {
        Branch branch = resolveAndAssertBranchAccess(branchId);
        planLimitChecker.requireFeature(branch.getStore(), PlanFeature.ADVANCED_REPORTS);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<Order> orders = calcHelper.filterRevenueOrders(
                orderRepository.findByBranchIdAndCreatedAtBetween(
                        branchId, targetDate.atStartOfDay(), targetDate.plusDays(1).atStartOfDay()
                )
        );
        return calcHelper.aggregateCategorySales(orders, getRefundedMapByBranch(branchId));
    }

    @Override
    public BranchOverviewDTO getTodayOverview(Long branchId) {
        resolveAndAssertBranchAccess(branchId);
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay();

        List<Order> todayOrders = calcHelper.filterRevenueOrders(
                orderRepository.findByBranchIdAndCreatedAtBetween(branchId, start, end)
        );
        Set<Long> todayCompletedIds = todayOrders.stream()
                .map(Order::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Refund> branchRefunds = refundRepository.findByBranchId(branchId);
        double partialRefundsOnTodayCompleted = branchRefunds.stream()
                .filter(r -> r.getOrder() != null && todayCompletedIds.contains(r.getOrder().getId()))
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();

        double todayGrossRevenue = todayOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0)
                .sum();
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
                todayRevenue, todayOrders.size(), todayRefunds,
                (int) activeShifts, (int) lowStock, calcHelper.round2(avgOrderValue)
        );
    }

    @Override
    public List<PaymentBreakdownDTO> getPaymentBreakdown(Long branchId, LocalDate date) {
        resolveAndAssertBranchAccess(branchId);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<Order> orders = calcHelper.filterRevenueOrders(
                orderRepository.findByBranchIdAndCreatedAtBetween(
                        branchId, targetDate.atStartOfDay(), targetDate.plusDays(1).atStartOfDay()
                )
        );
        return calcHelper.aggregatePaymentBreakdown(orders, getRefundedMapByBranch(branchId), true);
    }
}
