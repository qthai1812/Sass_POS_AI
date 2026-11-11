package com.zosh.service.analytics;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.modal.*;
import com.zosh.payload.response.CategorySalesDTO;
import com.zosh.payload.response.DailySalesDTO;
import com.zosh.payload.response.PaymentBreakdownDTO;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class AnalyticsCalculationHelperTest {

    private final AnalyticsCalculationHelper helper = new AnalyticsCalculationHelper();

    @Test
    void isCompletedRevenueOrder_allowsCompletedPartiallyRefundedNullAndExcludesOthers() {
        assertTrue(helper.isCompletedRevenueOrder(Order.builder().status(OrderStatus.COMPLETED).build()));
        assertTrue(helper.isCompletedRevenueOrder(Order.builder().status(OrderStatus.PARTIALLY_REFUNDED).build()));
        assertTrue(helper.isCompletedRevenueOrder(Order.builder().status(null).build()));

        assertFalse(helper.isCompletedRevenueOrder(Order.builder().status(OrderStatus.PENDING).build()));
        assertFalse(helper.isCompletedRevenueOrder(Order.builder().status(OrderStatus.CANCELLED).build()));
        assertFalse(helper.isCompletedRevenueOrder(Order.builder().status(OrderStatus.REFUNDED).build()));
    }

    @Test
    void buildRefundedMapAndNetOrderAmount_subtractsPartialRefundsClampedAtZero() {
        Order order = Order.builder().id(10L).totalAmount(250000.0).build();
        List<Refund> refunds = List.of(
                Refund.builder().id(1L).order(order).amount(50000.0).build(),
                Refund.builder().id(2L).order(order).amount(30000.0).build(),
                Refund.builder().id(3L).order(null).amount(99999.0).build()
        );

        Map<Long, Double> map = helper.buildRefundedMapByOrder(refunds);

        assertEquals(80000.0, map.get(10L));
        assertEquals(170000.0, helper.netOrderAmount(order, map));
        assertEquals(0.0, helper.netOrderAmount(Order.builder().id(10L).totalAmount(20000.0).build(), map));
    }

    @Test
    void effectiveItemNetRevenue_allocatesDiscountTaxAndRefundsProportionally() {
        Order order = Order.builder().id(5L).subTotal(200000.0).totalAmount(180000.0).build();
        OrderItem item = OrderItem.builder().price(100000.0).build();

        // Net order = 180k - 20k refund = 160k -> ratio = 160k / 200k = 0.8 -> item net = 80k
        double itemNet = helper.effectiveItemNetRevenue(order, item, Map.of(5L, 20000.0));
        assertEquals(80000.0, itemNet, 0.01);

        Order zeroSubTotalOrder = Order.builder().id(6L).subTotal(0.0).totalAmount(100000.0).build();
        assertEquals(100000.0, helper.effectiveItemNetRevenue(zeroSubTotalOrder, item, Map.of()), 0.01);
    }

    @Test
    void buildDailySalesSeries_fillsGapDaysWithZeros() {
        LocalDate today = LocalDate.of(2026, 11, 11);
        Order o = Order.builder()
                .id(1L)
                .totalAmount(120000.0)
                .createdAt(today.minusDays(2).atTime(10, 0))
                .build();

        List<DailySalesDTO> series = helper.buildDailySalesSeries(List.of(o), Map.of(1L, 20000.0), today, 3);

        assertEquals(3, series.size());
        assertEquals("2026-11-09", series.get(0).getDate());
        assertEquals(100000.0, series.get(0).getTotalSales());
        assertEquals(1, series.get(0).getTotalOrders());
        assertEquals(0.0, series.get(1).getTotalSales());
        assertEquals(0.0, series.get(2).getTotalSales());
    }

    @Test
    void aggregateCategorySales_groupsUncategorizedAndSortsDesc() {
        Category catA = Category.builder().id(1L).name("Shirts").build();
        Product p1 = Product.builder().id(10L).category(catA).build();
        Product p2 = Product.builder().id(11L).category(null).build();

        Order o = Order.builder()
                .id(1L).subTotal(300000.0).totalAmount(300000.0)
                .items(List.of(
                        OrderItem.builder().product(p1).quantity(2).price(200000.0).build(),
                        OrderItem.builder().product(p2).quantity(1).price(100000.0).build()
                ))
                .build();

        List<CategorySalesDTO> cats = helper.aggregateCategorySales(List.of(o), Map.of());

        assertEquals(2, cats.size());
        assertEquals("Shirts", cats.get(0).getCategoryName());
        assertEquals(2L, cats.get(0).getTotalQuantity());
        assertEquals(66.7, cats.get(0).getPercentage());
        assertEquals("Uncategorized", cats.get(1).getCategoryName());
    }

    @Test
    void aggregatePaymentBreakdown_respectsDefaultCashWhenNullFlag() {
        Order oNull = Order.builder().id(1L).paymentType(null).totalAmount(50000.0).build();
        Order oCard = Order.builder().id(2L).paymentType(PaymentType.CARD).totalAmount(150000.0).build();

        List<PaymentBreakdownDTO> storeMode = helper.aggregatePaymentBreakdown(List.of(oNull, oCard), Map.of(), false);
        assertEquals(1, storeMode.size());
        assertEquals("CARD", storeMode.get(0).getPaymentType());

        List<PaymentBreakdownDTO> branchMode = helper.aggregatePaymentBreakdown(List.of(oNull, oCard), Map.of(), true);
        assertEquals(2, branchMode.size());
    }
}
