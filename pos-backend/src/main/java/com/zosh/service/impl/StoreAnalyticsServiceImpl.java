package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.mapper.BranchMapper;
import com.zosh.mapper.ProductMapper;
import com.zosh.mapper.RefundMapper;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.BranchDTO;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.*;
import com.zosh.repository.*;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.StoreAnalyticsService;
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
    private final InventoryRepository inventoryRepository;
    private final StoreRepository storeRepository;
    private final RefundRepository refundRepository;
    private final PlanLimitChecker planLimitChecker;

    private Store resolveStoreAndValidateAccess(Long userOrStoreAdminId) throws Exception {
        User targetUser = userRepository.findById(userOrStoreAdminId)
                .orElseThrow(() -> new Exception("User not found: " + userOrStoreAdminId));

        Store store = storeRepository.findByStoreAdminId(targetUser.getId());
        if (store == null && targetUser.getStore() != null) {
            store = targetUser.getStore();
        }
        if (store == null) {
            throw new Exception("Store not found for user: " + userOrStoreAdminId);
        }

        String currentEmail = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(currentEmail);

        if (currentUser != null && currentUser.getRole() != UserRole.ROLE_ADMIN) {
            boolean isStoreOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(currentUser.getId());
            boolean isSameStoreEmployee = currentUser.getStore() != null && currentUser.getStore().getId().equals(store.getId());
            if (!isStoreOwner && !isSameStoreEmployee) {
                throw new AccessDeniedException("You do not have permission to view analytics of another store");
            }
        }
        return store;
    }

    private boolean isCompletedRevenueOrder(Order o) {
        return o != null && (o.getStatus() == null || o.getStatus() == OrderStatus.COMPLETED);
    }

    /** Tổng tiền đã hoàn theo từng orderId của cả cửa hàng (để trừ hoàn tiền một phần khỏi doanh thu thực thu). */
    private Map<Long, Double> getRefundedMapByStore(Long storeId) {
        return refundRepository.findByBranchStoreId(storeId).stream()
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
     * để phản ánh chiết khấu (discountAmount / coupon / điểm thưởng), thuế (taxAmount) và hoàn tiền một phần.
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

    private List<Order> getAllOrdersForUser(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        return orderRepository.findAllByStoreIdWithDetails(store.getId()).stream()
                .filter(this::isCompletedRevenueOrder)
                .collect(Collectors.toList());
    }

    @Override
    public StoreOverviewDTO getStoreOverview(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        List<Order> orders = getAllOrdersForUser(storeAdminId);

        Long storeId = store.getId();
        int totalBranches = (int) branchRepository.countByStoreId(storeId);
        int totalEmployees = (int) userRepository.countByStore(store);
        int totalProducts = (int) productRepository.countByStoreId(storeId);

        Map<Long, Double> refundedMap = getRefundedMapByStore(storeId);
        double totalRevenue = orders.stream().mapToDouble(o -> netOrderAmount(o, refundedMap)).sum();
        double avgOrderValue = orders.isEmpty() ? 0 : totalRevenue / orders.size();

        LocalDate now = LocalDate.now();
        double thisMonth = orders.stream()
                .filter(o -> o.getCreatedAt() != null && o.getCreatedAt().getMonth() == now.getMonth()
                        && o.getCreatedAt().getYear() == now.getYear())
                .mapToDouble(o -> netOrderAmount(o, refundedMap)).sum();

        double lastMonth = orders.stream()
                .filter(o -> o.getCreatedAt() != null && o.getCreatedAt().getMonth() == now.minusMonths(1).getMonth()
                        && o.getCreatedAt().getYear() == now.minusMonths(1).getYear())
                .mapToDouble(o -> netOrderAmount(o, refundedMap)).sum();

        double growth = lastMonth == 0 ? 0 : ((thisMonth - lastMonth) / lastMonth * 100);

        return new StoreOverviewDTO(totalRevenue, orders.size(), totalBranches,
                totalProducts, totalEmployees, Math.round(avgOrderValue * 100) / 100.0,
                Math.round(growth * 10) / 10.0);
    }

    @Override
    public List<SalesTrendDTO> getSalesTrends(Long storeAdminId, String period) throws Exception {
        Map<Long, Double> refundedMap = getRefundedMapByStore(resolveStoreAndValidateAccess(storeAdminId).getId());
        List<Order> orders = getAllOrdersForUser(storeAdminId);
        Map<String, double[]> grouped = new TreeMap<>();
        DateTimeFormatter fmt = "monthly".equalsIgnoreCase(period) ? DateTimeFormatter.ofPattern("yyyy-MM") :
                "weekly".equalsIgnoreCase(period) ? DateTimeFormatter.ofPattern("yyyy-'W'ww") :
                        DateTimeFormatter.ofPattern("yyyy-MM-dd");

        for (Order o : orders) {
            if (o.getCreatedAt() == null) continue;
            String key = o.getCreatedAt().format(fmt);
            grouped.computeIfAbsent(key, k -> new double[]{0, 0});
            grouped.get(key)[0] += netOrderAmount(o, refundedMap);
            grouped.get(key)[1]++;
        }

        List<SalesTrendDTO> result = new ArrayList<>();
        String[] keys = grouped.keySet().toArray(new String[0]);
        for (int i = 0; i < keys.length; i++) {
            String k = keys[i];
            double sales = grouped.get(k)[0];
            double prevSales = i > 0 ? grouped.get(keys[i - 1])[0] : 0;
            double growth = prevSales == 0 ? 0 : ((sales - prevSales) / prevSales * 100);
            result.add(new SalesTrendDTO(k, sales, (int) grouped.get(k)[1], Math.round(growth * 10) / 10.0));
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

        List<Order> recentOrders = orderRepository
                .findByStoreIdAndCreatedAtBetween(store.getId(), startRange, endRange)
                .stream()
                .filter(this::isCompletedRevenueOrder)
                .collect(Collectors.toList());

        Map<LocalDate, List<Order>> ordersByDate = recentOrders.stream()
                .filter(o -> o.getCreatedAt() != null)
                .collect(Collectors.groupingBy(o -> o.getCreatedAt().toLocalDate()));

        List<DailySalesDTO> result = new ArrayList<>();
        for (int i = 29; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            List<Order> dayOrders = ordersByDate.getOrDefault(date, Collections.emptyList());
            double total = dayOrders.stream().mapToDouble(o -> netOrderAmount(o, refundedMap)).sum();
            result.add(new DailySalesDTO(date.toString(), total, dayOrders.size()));
        }
        return result;
    }

    @Override
    public List<DailySalesDTO> getMonthlySales(Long storeAdminId) throws Exception {
        planLimitChecker.requireFeature(resolveStoreAndValidateAccess(storeAdminId), PlanFeature.ADVANCED_REPORTS);
        Map<Long, Double> refundedMap = getRefundedMapByStore(resolveStoreAndValidateAccess(storeAdminId).getId());
        List<Order> orders = getAllOrdersForUser(storeAdminId);
        Map<String, double[]> monthMap = new TreeMap<>();
        for (Order o : orders) {
            if (o.getCreatedAt() == null) continue;
            String key = o.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM"));
            monthMap.computeIfAbsent(key, k -> new double[]{0, 0});
            monthMap.get(key)[0] += netOrderAmount(o, refundedMap);
            monthMap.get(key)[1]++;
        }
        return monthMap.entrySet().stream()
                .map(e -> new DailySalesDTO(e.getKey(), e.getValue()[0], (int) e.getValue()[1]))
                .collect(Collectors.toList());
    }

    @Override
    public List<CategorySalesDTO> getSalesByCategory(Long storeAdminId) throws Exception {
        planLimitChecker.requireFeature(resolveStoreAndValidateAccess(storeAdminId), PlanFeature.ADVANCED_REPORTS);
        Map<Long, Double> refundedMap = getRefundedMapByStore(resolveStoreAndValidateAccess(storeAdminId).getId());
        List<Order> orders = getAllOrdersForUser(storeAdminId);
        Map<String, double[]> catMap = new HashMap<>();
        for (Order o : orders) {
            if (o.getItems() == null) continue;
            for (OrderItem item : o.getItems()) {
                if (item.getProduct() == null) continue;
                String cat = (item.getProduct().getCategory() != null && item.getProduct().getCategory().getName() != null)
                        ? item.getProduct().getCategory().getName()
                        : "Uncategorized";
                catMap.computeIfAbsent(cat, k -> new double[]{0, 0});
                catMap.get(cat)[0] += item.getQuantity() != null ? item.getQuantity() : 0;
                catMap.get(cat)[1] += effectiveItemNetRevenue(o, item, refundedMap);
            }
        }
        double totalRev = catMap.values().stream().mapToDouble(v -> v[1]).sum();
        return catMap.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[1], a.getValue()[1]))
                .map(e -> {
                    double rev = Math.round(e.getValue()[1] * 100.0) / 100.0;
                    double pct = totalRev == 0 ? 0 : (e.getValue()[1] * 100.0 / totalRev);
                    return new CategorySalesDTO(e.getKey(), (long) e.getValue()[0], rev, Math.round(pct * 10) / 10.0);
                })
                .collect(Collectors.toList());
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
        Map<Long, Double> refundedMap = getRefundedMapByStore(resolveStoreAndValidateAccess(storeAdminId).getId());
        List<Order> orders = getAllOrdersForUser(storeAdminId);
        Map<String, double[]> payMap = new HashMap<>();
        for (Order o : orders) {
            if (o.getPaymentType() == null) continue;
            String pt = o.getPaymentType().name();
            payMap.computeIfAbsent(pt, k -> new double[]{0, 0});
            payMap.get(pt)[0]++;
            payMap.get(pt)[1] += netOrderAmount(o, refundedMap);
        }
        double totalAmt = payMap.values().stream().mapToDouble(v -> v[1]).sum();
        return payMap.entrySet().stream()
                .map(e -> {
                    double pct = totalAmt == 0 ? 0 : (e.getValue()[1] * 100.0 / totalAmt);
                    return new PaymentBreakdownDTO(e.getKey(), (long) e.getValue()[0], e.getValue()[1], Math.round(pct * 10) / 10.0);
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<BranchPerformanceDTO> getBranchPerformance(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        List<Branch> branches = branchRepository.findByStoreId(store.getId());
        List<BranchPerformanceDTO> result = new ArrayList<>();
        for (Branch branch : branches) {
            List<Order> branchOrders = orderRepository.findByBranchId(branch.getId())
                    .stream()
                    .filter(this::isCompletedRevenueOrder)
                    .collect(Collectors.toList());
            double grossRev = branchOrders.stream().mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0).sum();
            Double partialRefunds = refundRepository.sumRefundsOnCompletedOrdersByBranchId(branch.getId());
            double rev = Math.max(0.0, grossRev - (partialRefunds != null ? partialRefunds : 0.0));
            double avg = branchOrders.isEmpty() ? 0 : rev / branchOrders.size();
            int empCount = (int) userRepository.countByBranchId(branch.getId());
            result.add(new BranchPerformanceDTO(branch.getId(), branch.getName(), rev, branchOrders.size(), empCount, Math.round(avg * 100) / 100.0));
        }
        return result.stream().sorted((a, b) -> Double.compare(b.getTotalRevenue(), a.getTotalRevenue())).collect(Collectors.toList());
    }

    @Override
    public StoreAlertsDTO getStoreAlerts(Long storeAdminId) throws Exception {
        Store store = resolveStoreAndValidateAccess(storeAdminId);
        Long storeId = store.getId();
        List<Branch> branches = branchRepository.findByStoreId(storeId);

        Map<String, ProductDTO> lowStockAlertMap = new LinkedHashMap<>();
        List<BranchDTO> noSaleToday = new ArrayList<>();
        List<UserDto> inactiveCashiers = new ArrayList<>();
        List<Object> refundSpike = new ArrayList<>();

        LocalDate today = LocalDate.now();
        LocalDateTime cutoff7Days = LocalDateTime.now().minusDays(7);

        for (Branch branch : branches) {
            List<Order> todayOrders = orderRepository.findByBranchIdAndCreatedAtBetween(
                            branch.getId(), today.atStartOfDay(), today.plusDays(1).atStartOfDay())
                    .stream()
                    .filter(this::isCompletedRevenueOrder)
                    .collect(Collectors.toList());
            if (todayOrders.isEmpty()) {
                noSaleToday.add(BranchMapper.toDTO(branch));
            }

            List<Inventory> inventories = inventoryRepository.findByBranchId(branch.getId());
            for (Inventory inv : inventories) {
                if (inv.getQuantity() != null && inv.getMinStockLevel() != null && inv.getQuantity() <= inv.getMinStockLevel()) {
                    if (inv.getProduct() != null && inv.getProduct().getId() != null) {
                        ProductDTO dto = ProductMapper.toDTO(inv.getProduct());
                        dto.setQuantity(inv.getQuantity());
                        dto.setName(inv.getProduct().getName() + " (" + branch.getName() + ")");
                        lowStockAlertMap.put(branch.getId() + "-" + inv.getProduct().getId(), dto);
                    }
                }
            }

            List<User> branchCashiers = userRepository.findByBranchId(branch.getId());
            for (User cashier : branchCashiers) {
                if (cashier.getRole() == UserRole.ROLE_BRANCH_CASHIER) {
                    if (cashier.getLastLogin() == null || cashier.getLastLogin().isBefore(cutoff7Days)) {
                        inactiveCashiers.add(UserMapper.toDTO(cashier));
                    }
                }
            }

            List<Refund> branchRefunds = refundRepository.findByBranchId(branch.getId());
            for (Refund refund : branchRefunds) {
                if (refund.getCreatedAt() == null || !refund.getCreatedAt().isBefore(cutoff7Days)) {
                    refundSpike.add(RefundMapper.toDTO(refund));
                }
            }
        }

        return StoreAlertsDTO.builder()
                .inactiveCashiers(inactiveCashiers)
                .lowStockAlerts(new ArrayList<>(lowStockAlertMap.values()))
                .noSaleToday(noSaleToday)
                .refundSpike(refundSpike)
                .build();
    }
}
