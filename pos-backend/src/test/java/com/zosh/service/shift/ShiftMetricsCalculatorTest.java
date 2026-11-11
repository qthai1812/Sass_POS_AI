package com.zosh.service.shift;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.modal.*;
import com.zosh.service.shift.ShiftMetricsCalculator.ShiftMetrics;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShiftMetricsCalculatorTest {

    private final ShiftMetricsCalculator calculator = new ShiftMetricsCalculator();

    @Test
    void isCompletedSalesOrder_excludesPendingAndCancelled() {
        assertTrue(calculator.isCompletedSalesOrder(Order.builder().status(OrderStatus.COMPLETED).build()));
        assertTrue(calculator.isCompletedSalesOrder(Order.builder().status(OrderStatus.PARTIALLY_REFUNDED).build()));
        assertTrue(calculator.isCompletedSalesOrder(Order.builder().status(OrderStatus.REFUNDED).build()));
        assertTrue(calculator.isCompletedSalesOrder(Order.builder().status(null).build()));

        assertFalse(calculator.isCompletedSalesOrder(Order.builder().status(OrderStatus.PENDING).build()));
        assertFalse(calculator.isCompletedSalesOrder(Order.builder().status(OrderStatus.CANCELLED).build()));
        assertFalse(calculator.isCompletedSalesOrder(null));
    }

    @Test
    void calculateAndAttach_computesGrossNetOrdersAndAttachesLists() {
        Product p1 = Product.builder().id(1L).name("Shirt").build();
        Product p2 = Product.builder().id(2L).name("Pants").build();

        Order completed = Order.builder()
                .id(10L)
                .status(OrderStatus.COMPLETED)
                .paymentType(PaymentType.CASH)
                .totalAmount(300000.0)
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .items(List.of(
                        OrderItem.builder().product(p1).quantity(2).build(),
                        OrderItem.builder().product(p2).quantity(1).build()
                ))
                .build();
        Order refundedOrder = Order.builder()
                .id(11L)
                .status(OrderStatus.REFUNDED)
                .paymentType(PaymentType.CARD)
                .totalAmount(100000.0)
                .createdAt(LocalDateTime.now().minusMinutes(5))
                .items(List.of(OrderItem.builder().product(p1).quantity(1).build()))
                .build();
        Order pending = Order.builder()
                .id(12L)
                .status(OrderStatus.PENDING)
                .totalAmount(500000.0)
                .createdAt(LocalDateTime.now())
                .build();

        Refund refundInShift = Refund.builder().id(99L).amount(100000.0).build();
        ShiftReport report = ShiftReport.builder().id(1L).build();

        ShiftMetrics metrics = calculator.calculateAndAttach(
                report,
                List.of(completed, refundedOrder, pending),
                List.of(refundInShift)
        );

        assertEquals(400000.0, metrics.totalSales());
        assertEquals(100000.0, metrics.totalRefunds());
        assertEquals(300000.0, metrics.netSales());
        assertEquals(2, metrics.totalOrders());

        assertEquals(2, report.getTopSellingProducts().size());
        assertEquals(1L, report.getTopSellingProducts().get(0).getId());
        assertEquals(3, report.getTopSellingProducts().get(0).getQuantity());
        assertEquals(3, report.getRecentOrders().size());
        assertEquals(2, report.getPaymentSummaries().size());
    }

    @Test
    void computePaymentSummaries_defaultsNullPaymentToCashWithPercentages() {
        Order o1 = Order.builder().status(OrderStatus.COMPLETED).paymentType(null).totalAmount(75000.0).build();
        Order o2 = Order.builder().status(OrderStatus.COMPLETED).paymentType(PaymentType.UPI).totalAmount(25000.0).build();

        List<PaymentSummary> summaries = calculator.computePaymentSummaries(List.of(o1, o2));

        PaymentSummary cash = summaries.stream().filter(s -> s.getType() == PaymentType.CASH).findFirst().orElseThrow();
        PaymentSummary upi = summaries.stream().filter(s -> s.getType() == PaymentType.UPI).findFirst().orElseThrow();

        assertEquals(75.0, cash.getPercentage(), 0.01);
        assertEquals(1, cash.getTransactionCount());
        assertEquals(25.0, upi.getPercentage(), 0.01);
    }

    @Test
    void computeTopSellingProducts_limitsToTop5Descending() {
        List<OrderItem> items = new ArrayList<>();
        for (long i = 1; i <= 7; i++) {
            Product p = Product.builder().id(i).name("Item " + i).build();
            items.add(OrderItem.builder().product(p).quantity((int) i * 2).build());
        }
        Order o = Order.builder().status(OrderStatus.COMPLETED).totalAmount(1000.0).items(items).build();

        List<Product> top = calculator.computeTopSellingProducts(List.of(o));

        assertEquals(5, top.size());
        assertEquals(7L, top.get(0).getId());
        assertEquals(14, top.get(0).getQuantity());
        assertEquals(3L, top.get(4).getId());
    }

    @Test
    void getRecentOrders_returnsTop5SortedNewestFirst() {
        List<Order> orders = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            orders.add(Order.builder()
                    .id((long) i)
                    .createdAt(LocalDateTime.of(2026, 11, 10, i, 0))
                    .build());
        }

        List<Order> recent = calculator.getRecentOrders(orders);

        assertEquals(5, recent.size());
        assertEquals(7L, recent.get(0).getId());
        assertEquals(3L, recent.get(4).getId());
    }
}
