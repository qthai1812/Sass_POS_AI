package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.PlanFeature;
import com.zosh.modal.*;
import com.zosh.payload.response.*;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.analytics.AnalyticsCalculationHelper;
import jakarta.persistence.EntityNotFoundException;
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
class BranchAnalyticsServiceImplTest {

    @Mock private OrderRepository orderRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private AccessControlService accessControl;
    @Spy private AnalyticsCalculationHelper calcHelper = new AnalyticsCalculationHelper();

    @InjectMocks
    private BranchAnalyticsServiceImpl branchAnalyticsService;

    private Store store;
    private Branch branch;
    private User user;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        branch = Branch.builder().id(10L).name("Branch 1").store(store).build();
        user = new User();
        user.setId(50L);
    }

    private void stubAccessAllowed() throws Exception {
        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(accessControl.currentUser()).thenReturn(user);
        when(accessControl.canAccessBranch(user, branch)).thenReturn(true);
    }

    @Test
    void resolveAccess_missingBranchOrDenied_throwsExpectedExceptions() throws Exception {
        when(branchRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(EntityNotFoundException.class, () -> branchAnalyticsService.getTodayOverview(99L));

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(accessControl.currentUser()).thenReturn(user);
        when(accessControl.canAccessBranch(user, branch)).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> branchAnalyticsService.getTodayOverview(10L));
    }

    @Test
    void getDailySalesChart_enforcesMinimum1DayAndComputesNetTotals() throws Exception {
        stubAccessAllowed();
        Order o = Order.builder().id(1L).status(OrderStatus.COMPLETED).totalAmount(120000.0)
                .createdAt(LocalDateTime.now()).build();
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(10L), any(), any())).thenReturn(List.of(o));
        when(refundRepository.findByBranchId(10L))
                .thenReturn(List.of(Refund.builder().id(5L).order(o).amount(20000.0).build()));

        List<DailySalesDTO> chart = branchAnalyticsService.getDailySalesChart(10L, 0);

        assertEquals(1, chart.size());
        assertEquals(100000.0, chart.get(0).getTotalSales());
    }

    @Test
    void getTopProductsByQuantity_computesProportionalRevenue() throws Exception {
        stubAccessAllowed();
        Product p = Product.builder().id(7L).name("Jeans").sku("J-01").build();
        Order order = Order.builder()
                .id(1L).status(OrderStatus.COMPLETED).subTotal(200000.0).totalAmount(180000.0)
                .items(List.of(OrderItem.builder().product(p).quantity(2).price(200000.0).build()))
                .build();

        when(orderRepository.findByBranchId(10L)).thenReturn(List.of(order));
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of());

        List<TopProductDTO> top = branchAnalyticsService.getTopProductsByQuantity(10L);

        assertEquals(1, top.size());
        assertEquals(2L, top.get(0).getTotalQuantity());
        assertEquals(180000.0, top.get(0).getTotalRevenue());
    }

    @Test
    void getTopCashiersByRevenue_sortsDescAndHandlesPartialRefund() throws Exception {
        stubAccessAllowed();
        User c1 = new User();
        c1.setId(1L);
        c1.setFullName("Cashier A");
        User c2 = new User();
        c2.setId(2L);
        c2.setFullName("Cashier B");

        Order o1 = Order.builder().id(101L).cashier(c1).status(OrderStatus.COMPLETED).totalAmount(100000.0).build();
        Order o2 = Order.builder().id(102L).cashier(c2).status(OrderStatus.COMPLETED).totalAmount(300000.0).build();
        Refund refundOnO2 = Refund.builder().id(1L).order(o2).amount(50000.0).build();

        when(orderRepository.findByBranchId(10L)).thenReturn(List.of(o1, o2));
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of(refundOnO2));

        List<TopCashierDTO> top = branchAnalyticsService.getTopCashiersByRevenue(10L);

        assertEquals(2, top.size());
        assertEquals(2L, top.get(0).getCashierId());
        assertEquals(250000.0, top.get(0).getTotalRevenue());
    }

    @Test
    void getCategoryWiseSalesBreakdown_checksFeatureAndAggregates() throws Exception {
        stubAccessAllowed();
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(10L), any(), any())).thenReturn(List.of());
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of());

        List<CategorySalesDTO> list = branchAnalyticsService.getCategoryWiseSalesBreakdown(10L, LocalDate.now());

        verify(planLimitChecker).requireFeature(store, PlanFeature.ADVANCED_REPORTS);
        assertTrue(list.isEmpty());
    }

    @Test
    void getTodayOverview_andPaymentBreakdown_computeCorrectMetrics() throws Exception {
        stubAccessAllowed();
        Order o = Order.builder().id(5L).status(OrderStatus.COMPLETED).totalAmount(200000.0).paymentType(null).build();
        Refund r = Refund.builder().id(6L).order(o).amount(50000.0).createdAt(LocalDateTime.now()).build();
        ShiftReport open = ShiftReport.builder().id(7L).shiftStart(LocalDateTime.now()).shiftEnd(null).build();
        Inventory low = Inventory.builder().id(8L).quantity(2).minStockLevel(5).build();

        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(10L), any(), any())).thenReturn(List.of(o));
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of(r));
        when(shiftReportRepository.findByBranchId(10L)).thenReturn(List.of(open));
        when(inventoryRepository.findByBranchId(10L)).thenReturn(List.of(low));

        BranchOverviewDTO overview = branchAnalyticsService.getTodayOverview(10L);
        assertEquals(150000.0, overview.getTodayRevenue());
        assertEquals(1, overview.getTodayOrders());
        assertEquals(50000.0, overview.getTodayRefunds());
        assertEquals(1, overview.getActiveShifts());
        assertEquals(1, overview.getLowStockItems());

        List<PaymentBreakdownDTO> payments = branchAnalyticsService.getPaymentBreakdown(10L, null);
        assertEquals(1, payments.size());
        assertEquals(PaymentType.CASH.name(), payments.get(0).getPaymentType());
        assertEquals(150000.0, payments.get(0).getTotalAmount());
    }
}
