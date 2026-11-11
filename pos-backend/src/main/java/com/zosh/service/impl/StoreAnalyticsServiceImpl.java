package com.zosh.service.impl;

import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Order;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.response.*;
import com.zosh.repository.*;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.StoreAnalyticsService;
import com.zosh.service.UserService;
import com.zosh.service.analytics.AnalyticsCalculationHelper;
import com.zosh.service.analytics.StoreAlertScanner;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StoreAnalyticsServiceImpl implements StoreAnalyticsService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final RefundRepository refundRepository;
    private final PlanLimitChecker planLimitChecker;
    private final UserService userService;
    private final AnalyticsCalculationHelper calcHelper;
    private final StoreAlertScanner alertScanner;

    private Store resolveStoreAndValidateAccess(Long userOrStoreAdminId) throws Exception {
        User currentUser = userService.getCurrentUser();
        User targetUser = userRepository.findById(userOrStoreAdminId)
                .orElseThrow(() -> new Exception("User not found: " + userOrStoreAdminId));

        Store store = storeRepository.findByStoreAdminId(targetUser.getId());
        if (store == null && targetUser.getStore() != null) {
            store = targetUser.getStore();
        }
        if (store == null) {
            throw new Exception("Store not found for user: " + userOrStoreAdminId);
        }

        boolean isStoreOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(currentUser.getId());
        boolean isStoreOwnerRole = currentUser.getRole() == UserRole.ROLE_STORE_OWNER
                && currentUser.getStore() != null
                && currentUser.getStore().getId().equals(store.getId());
        if (!isStoreOwner && !isStoreOwnerRole) {
            throw new AccessDeniedException("You do not have permission to view analytics of this store");
        }
        return store;
    }

    private Map<Long, Double> getRefundedMapByStore(Long storeId) {
        return calcHelper.buildRefundedMapByOrder(refundRepository.findByBranchStoreId(storeId));
    }

    private List<Order> getCompletedOrdersForStore(Store store) {
        return calcHelper.filterRevenueOrders(orderRepository.findAllByStoreIdWithDetails(store.getId()));
    }

    @Override
    public StoreOverviewDTO getStoreOverview(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        List<Order> orders = getCompletedOrdersForStore(store);

        Long storeId = store.getId();
        int totalBranches = (int) branchRepository.countByStoreId(storeId);
        int totalEmployees = (int) userRepository.countByStore(store);
        int totalProducts = (int) productRepository.countByStoreId(storeId);

        Map<Long, Double> refundedMap = getRefundedMapByStore(storeId);
        double totalRevenue = orders.stream().mapToDouble(o -> calcHelper.netOrderAmount(o, refundedMap)).sum();
        double avgOrderValue = orders.isEmpty() ? 0 : totalRevenue / orders.size();

        LocalDate now = LocalDate.now();
        double thisMonth = sumRevenueForMonth(orders, refundedMap, now);
        double lastMonth = sumRevenueForMonth(orders, refundedMap, now.minusMonths(1));
        double growth = lastMonth == 0 ? 0 : ((thisMonth - lastMonth) / lastMonth * 100);

        return new StoreOverviewDTO(
                totalRevenue, orders.size(), totalBranches, totalProducts, totalEmployees,
                calcHelper.round2(avgOrderValue), calcHelper.round1(growth)
        );
    }

    @Override
    public List<SalesTrendDTO> getSalesTrends(Long storeAdminId, String period) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        planLimitChecker.requireFeature(store, PlanFeature.ADVANCED_REPORTS);
        Map<Long, Double> refundedMap = getRefundedMapByStore(store.getId());
        List<Order> orders = getCompletedOrdersForStore(store);

        DateTimeFormatter fmt = "monthly".equalsIgnoreCase(period) ? DateTimeFormatter.ofPattern("yyyy-MM") :
                "weekly".equalsIgnoreCase(period) ? DateTimeFormatter.ofPattern("yyyy-'W'ww") :
                        DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, double[]> grouped = groupOrdersByFormat(orders, refundedMap, fmt);

        List<SalesTrendDTO> result = new ArrayList<>();
        String[] keys = grouped.keySet().toArray(new String[0]);
        for (int i = 0; i < keys.length; i++) {
            String k = keys[i];
            double sales = grouped.get(k)[0];
            double prevSales = i > 0 ? grouped.get(keys[i - 1])[0] : 0;
            double growth = prevSales == 0 ? 0 : ((sales - prevSales) / prevSales * 100);
            result.add(new SalesTrendDTO(k, sales, (int) grouped.get(k)[1], calcHelper.round1(growth)));
        }
        return result;
    }

    @Override
    public List<DailySalesDTO> getDailySales(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        Map<Long, Double> refundedMap = getRefundedMapByStore(store.getId());
        LocalDate today = LocalDate.now();
        LocalDateTime startRange = today.minusDays(29).atStartOfDay();
        LocalDateTime endRange = today.plusDays(1).atStartOfDay();

        List<Order> recentOrders = calcHelper.filterRevenueOrders(
                orderRepository.findByStoreIdAndCreatedAtBetween(store.getId(), startRange, endRange)
        );
        return calcHelper.buildDailySalesSeries(recentOrders, refundedMap, today, 30);
    }

    @Override
    public List<DailySalesDTO> getMonthlySales(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        planLimitChecker.requireFeature(store, PlanFeature.ADVANCED_REPORTS);
        Map<Long, Double> refundedMap = getRefundedMapByStore(store.getId());
        List<Order> orders = getCompletedOrdersForStore(store);

        Map<String, double[]> monthMap = groupOrdersByFormat(orders, refundedMap, DateTimeFormatter.ofPattern("yyyy-MM"));
        return monthMap.entrySet().stream()
                .map(e -> new DailySalesDTO(e.getKey(), e.getValue()[0], (int) e.getValue()[1]))
                .collect(Collectors.toList());
    }

    @Override
    public List<CategorySalesDTO> getSalesByCategory(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        planLimitChecker.requireFeature(store, PlanFeature.ADVANCED_REPORTS);
        Map<Long, Double> refundedMap = getRefundedMapByStore(store.getId());
        List<Order> orders = getCompletedOrdersForStore(store);
        return calcHelper.aggregateCategorySales(orders, refundedMap);
    }

    @Override
    public List<PaymentBreakdownDTO> getSalesByPaymentMethod(Long storeAdminId) throws Exception {
        return getPaymentBreakdown(storeAdminId);
    }

    @Override
    public List<BranchPerformanceDTO> getSalesByBranch(Long storeAdminId) throws Exception {
        return getBranchPerformance(storeAdminId);
    }

    @Override
    public List<PaymentBreakdownDTO> getPaymentBreakdown(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        Map<Long, Double> refundedMap = getRefundedMapByStore(store.getId());
        List<Order> orders = getCompletedOrdersForStore(store);
        return calcHelper.aggregatePaymentBreakdown(orders, refundedMap, false);
    }

    @Override
    public List<BranchPerformanceDTO> getBranchPerformance(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        List<Branch> branches = branchRepository.findByStoreId(store.getId());
        List<BranchPerformanceDTO> result = new ArrayList<>();
        for (Branch branch : branches) {
            List<Order> branchOrders = calcHelper.filterRevenueOrders(orderRepository.findByBranchId(branch.getId()));
            double grossRev = branchOrders.stream()
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0)
                    .sum();
            Double partialRefunds = refundRepository.sumRefundsOnCompletedOrdersByBranchId(branch.getId());
            double rev = Math.max(0.0, grossRev - (partialRefunds != null ? partialRefunds : 0.0));
            double avg = branchOrders.isEmpty() ? 0 : rev / branchOrders.size();
            int empCount = (int) userRepository.countByBranchId(branch.getId());
            result.add(new BranchPerformanceDTO(
                    branch.getId(), branch.getName(), rev, branchOrders.size(), empCount, calcHelper.round2(avg)
            ));
        }
        return result.stream()
                .sorted((a, b) -> Double.compare(b.getTotalRevenue(), a.getTotalRevenue()))
                .collect(Collectors.toList());
    }

    @Override
    public StoreAlertsDTO getStoreAlerts(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        return alertScanner.scanStoreAlerts(store.getId());
    }

    private double sumRevenueForMonth(List<Order> orders, Map<Long, Double> refundedMap, LocalDate targetMonth) {
        return orders.stream()
                .filter(o -> o.getCreatedAt() != null
                        && o.getCreatedAt().getMonth() == targetMonth.getMonth()
                        && o.getCreatedAt().getYear() == targetMonth.getYear())
                .mapToDouble(o -> calcHelper.netOrderAmount(o, refundedMap))
                .sum();
    }

    private Map<String, double[]> groupOrdersByFormat(
            List<Order> orders,
            Map<Long, Double> refundedMap,
            DateTimeFormatter formatter
    ) {
        Map<String, double[]> grouped = new TreeMap<>();
        for (Order o : orders) {
            if (o.getCreatedAt() == null) {
                continue;
            }
            String key = o.getCreatedAt().format(formatter);
            grouped.computeIfAbsent(key, k -> new double[]{0, 0});
            grouped.get(key)[0] += calcHelper.netOrderAmount(o, refundedMap);
            grouped.get(key)[1]++;
        }
        return grouped;
    }
}
