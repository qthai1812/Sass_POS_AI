package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.response.*;
import com.zosh.repository.*;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import com.zosh.service.analytics.AnalyticsCalculationHelper;
import com.zosh.service.analytics.StoreAlertScanner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoreAnalyticsServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private UserService userService;
    @Spy private AnalyticsCalculationHelper calcHelper = new AnalyticsCalculationHelper();
    @Mock private StoreAlertScanner alertScanner;

    @InjectMocks
    private StoreAnalyticsServiceImpl storeAnalyticsService;

    private User owner;
    private Store store;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        store = new Store();
        store.setId(100L);
        store.setBrand("Zosh Fashion");
        store.setStoreAdmin(owner);
        owner.setStore(store);
    }

    private void stubOwnerAccess() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(userRepository.findById(10L)).thenReturn(Optional.of(owner));
        when(storeRepository.findByStoreAdminId(10L)).thenReturn(store);
    }

    @Test
    void getStoreOverview_unauthorizedUser_throwsAccessDenied() throws Exception {
        User otherUser = new User();
        otherUser.setId(99L);
        otherUser.setRole(UserRole.ROLE_STORE_OWNER);

        when(userService.getCurrentUser()).thenReturn(otherUser);
        when(userRepository.findById(10L)).thenReturn(Optional.of(owner));
        when(storeRepository.findByStoreAdminId(10L)).thenReturn(store);

        assertThrows(AccessDeniedException.class, () -> storeAnalyticsService.getStoreOverview(10L));
    }

    @Test
    void getStoreOverview_calculatesNetRevenueGrowthAndAov() throws Exception {
        stubOwnerAccess();
        LocalDate now = LocalDate.now();
        Order lastMonthOrder = Order.builder()
                .id(1L).status(OrderStatus.COMPLETED).totalAmount(200000.0)
                .createdAt(now.minusMonths(1).atTime(10, 0)).build();
        Order thisMonthOrder = Order.builder()
                .id(2L).status(OrderStatus.PARTIALLY_REFUNDED).totalAmount(400000.0)
                .createdAt(now.atTime(10, 0)).build();
        Refund partialRefund = Refund.builder().id(5L).order(thisMonthOrder).amount(100000.0).build();

        when(orderRepository.findAllByStoreIdWithDetails(100L)).thenReturn(List.of(lastMonthOrder, thisMonthOrder));
        when(refundRepository.findByBranchStoreId(100L)).thenReturn(List.of(partialRefund));
        when(branchRepository.countByStoreId(100L)).thenReturn(2L);
        when(userRepository.countByStore(store)).thenReturn(6L);
        when(productRepository.countByStoreId(100L)).thenReturn(30L);

        StoreOverviewDTO overview = storeAnalyticsService.getStoreOverview(10L);

        // Total net = 200k + (400k - 100k) = 500k; thisMonth=300k vs lastMonth=200k => +50%
        assertEquals(500000.0, overview.getTotalRevenue());
        assertEquals(2, overview.getTotalOrders());
        assertEquals(250000.0, overview.getAvgOrderValue());
        assertEquals(50.0, overview.getMonthlyGrowthRate());
    }

    @Test
    void getSalesTrends_requiresAdvancedReportsAndComputesGrowth() throws Exception {
        stubOwnerAccess();
        Order o1 = Order.builder().id(1L).status(OrderStatus.COMPLETED).totalAmount(100000.0)
                .createdAt(LocalDateTime.of(2026, 9, 10, 10, 0)).build();
        Order o2 = Order.builder().id(2L).status(OrderStatus.COMPLETED).totalAmount(150000.0)
                .createdAt(LocalDateTime.of(2026, 10, 10, 10, 0)).build();

        when(orderRepository.findAllByStoreIdWithDetails(100L)).thenReturn(List.of(o1, o2));
        when(refundRepository.findByBranchStoreId(100L)).thenReturn(List.of());

        List<SalesTrendDTO> trends = storeAnalyticsService.getSalesTrends(10L, "monthly");

        verify(planLimitChecker).requireFeature(store, PlanFeature.ADVANCED_REPORTS);
        assertEquals(2, trends.size());
        assertEquals("2026-09", trends.get(0).getPeriod());
        assertEquals("2026-10", trends.get(1).getPeriod());
        assertEquals(50.0, trends.get(1).getGrowth());
    }

    @Test
    void getDailySales_returns30DaySeries() throws Exception {
        stubOwnerAccess();
        when(refundRepository.findByBranchStoreId(100L)).thenReturn(List.of());
        when(orderRepository.findByStoreIdAndCreatedAtBetween(eq(100L), any(), any())).thenReturn(List.of());

        List<DailySalesDTO> daily = storeAnalyticsService.getDailySales(10L);

        assertEquals(30, daily.size());
    }

    @Test
    void getPaymentBreakdown_aggregatesNetAmounts() throws Exception {
        stubOwnerAccess();
        Order o = Order.builder().id(1L).status(OrderStatus.COMPLETED).paymentType(PaymentType.UPI).totalAmount(100000.0).build();
        when(orderRepository.findAllByStoreIdWithDetails(100L)).thenReturn(List.of(o));
        when(refundRepository.findByBranchStoreId(100L)).thenReturn(List.of());

        List<PaymentBreakdownDTO> breakdown = storeAnalyticsService.getPaymentBreakdown(10L);

        assertEquals(1, breakdown.size());
        assertEquals("UPI", breakdown.get(0).getPaymentType());
        assertEquals(100.0, breakdown.get(0).getPercentage());
    }

    @Test
    void getBranchPerformance_subtractsPartialRefundsAndSortsDesc() throws Exception {
        stubOwnerAccess();
        Branch b1 = Branch.builder().id(1L).name("Low Rev").build();
        Branch b2 = Branch.builder().id(2L).name("High Rev").build();

        when(branchRepository.findByStoreId(100L)).thenReturn(List.of(b1, b2));
        when(orderRepository.findByBranchId(1L))
                .thenReturn(List.of(Order.builder().id(10L).status(OrderStatus.COMPLETED).totalAmount(200000.0).build()));
        when(refundRepository.sumRefundsOnCompletedOrdersByBranchId(1L)).thenReturn(50000.0);
        when(userRepository.countByBranchId(1L)).thenReturn(2L);

        when(orderRepository.findByBranchId(2L))
                .thenReturn(List.of(Order.builder().id(20L).status(OrderStatus.COMPLETED).totalAmount(500000.0).build()));
        when(refundRepository.sumRefundsOnCompletedOrdersByBranchId(2L)).thenReturn(0.0);
        when(userRepository.countByBranchId(2L)).thenReturn(4L);

        List<BranchPerformanceDTO> perf = storeAnalyticsService.getBranchPerformance(10L);

        assertEquals(2, perf.size());
        assertEquals(2L, perf.get(0).getBranchId());
        assertEquals(500000.0, perf.get(0).getTotalRevenue());
        assertEquals(150000.0, perf.get(1).getTotalRevenue());
    }

    @Test
    void getStoreAlerts_delegatesToAlertScanner() throws Exception {
        stubOwnerAccess();
        StoreAlertsDTO expected = StoreAlertsDTO.builder().build();
        when(alertScanner.scanStoreAlerts(100L)).thenReturn(expected);

        assertSame(expected, storeAnalyticsService.getStoreAlerts(10L));
    }
}
