package com.zosh.service.analytics;

import com.zosh.domain.OrderStatus;
import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Refund;
import com.zosh.payload.response.CategorySalesDTO;
import com.zosh.payload.response.DailySalesDTO;
import com.zosh.payload.response.PaymentBreakdownDTO;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Tiện ích tính toán doanh thu thực thu (net revenue), phân bổ hoàn tiền một phần,
 * tổng hợp danh mục / phương thức thanh toán / chuỗi ngày dùng chung cho StoreAnalytics và BranchAnalytics.
 */
@Component
public class AnalyticsCalculationHelper {

    public boolean isCompletedRevenueOrder(Order order) {
        return order != null
                && (order.getStatus() == null
                || order.getStatus() == OrderStatus.COMPLETED
                || order.getStatus() == OrderStatus.PARTIALLY_REFUNDED);
    }

    public List<Order> filterRevenueOrders(List<Order> orders) {
        if (orders == null) {
            return Collections.emptyList();
        }
        return orders.stream()
                .filter(this::isCompletedRevenueOrder)
                .collect(Collectors.toList());
    }

    /** Tổng tiền đã hoàn theo từng orderId (để trừ hoàn tiền một phần khỏi doanh thu thực thu). */
    public Map<Long, Double> buildRefundedMapByOrder(List<Refund> refunds) {
        if (refunds == null || refunds.isEmpty()) {
            return Collections.emptyMap();
        }
        return refunds.stream()
                .filter(r -> r.getOrder() != null && r.getOrder().getId() != null)
                .collect(Collectors.groupingBy(
                        r -> r.getOrder().getId(),
                        Collectors.summingDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                ));
    }

    /** Doanh thu thực thu của đơn = tổng tiền đơn trừ tiền đã hoàn (một phần) trên đơn đó. */
    public double netOrderAmount(Order order, Map<Long, Double> refundedByOrderId) {
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
    public double effectiveItemNetRevenue(Order order, OrderItem item, Map<Long, Double> refundedByOrderId) {
        double rawItemPrice = (item != null && item.getPrice() != null) ? item.getPrice() : 0.0;
        if (order == null || rawItemPrice <= 0) {
            return 0.0;
        }
        double subTotal = order.getSubTotal() != null ? order.getSubTotal() : 0.0;
        if (subTotal > 0) {
            return rawItemPrice * (netOrderAmount(order, refundedByOrderId) / subTotal);
        }
        return rawItemPrice;
    }

    public List<DailySalesDTO> buildDailySalesSeries(
            List<Order> completedOrders,
            Map<Long, Double> refundedMap,
            LocalDate today,
            int days
    ) {
        int safeDays = Math.max(1, days);
        Map<LocalDate, List<Order>> ordersByDate = completedOrders.stream()
                .filter(o -> o.getCreatedAt() != null)
                .collect(Collectors.groupingBy(o -> o.getCreatedAt().toLocalDate()));

        List<DailySalesDTO> result = new ArrayList<>(safeDays);
        for (int i = safeDays - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            List<Order> dayOrders = ordersByDate.getOrDefault(date, Collections.emptyList());
            double total = dayOrders.stream().mapToDouble(o -> netOrderAmount(o, refundedMap)).sum();
            result.add(new DailySalesDTO(date.toString(), total, dayOrders.size()));
        }
        return result;
    }

    public List<CategorySalesDTO> aggregateCategorySales(List<Order> orders, Map<Long, Double> refundedMap) {
        Map<String, double[]> categoryStats = new HashMap<>();
        for (Order order : orders) {
            if (order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() == null) {
                    continue;
                }
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
                    double rev = round2(e.getValue()[1]);
                    double pct = totalRevenue == 0 ? 0 : (e.getValue()[1] * 100.0 / totalRevenue);
                    return new CategorySalesDTO(e.getKey(), (long) e.getValue()[0], rev, round1(pct));
                })
                .collect(Collectors.toList());
    }

    public List<PaymentBreakdownDTO> aggregatePaymentBreakdown(
            List<Order> orders,
            Map<Long, Double> refundedMap,
            boolean defaultCashWhenNull
    ) {
        Map<String, double[]> paymentStats = new HashMap<>();
        for (Order order : orders) {
            if (order.getPaymentType() == null && !defaultCashWhenNull) {
                continue;
            }
            String pt = order.getPaymentType() != null ? order.getPaymentType().name() : "CASH";
            paymentStats.computeIfAbsent(pt, k -> new double[]{0, 0});
            paymentStats.get(pt)[0]++;
            paymentStats.get(pt)[1] += netOrderAmount(order, refundedMap);
        }
        double totalAmount = paymentStats.values().stream().mapToDouble(v -> v[1]).sum();
        return paymentStats.entrySet().stream()
                .map(e -> {
                    double pct = totalAmount == 0 ? 0 : (e.getValue()[1] * 100.0 / totalAmount);
                    return new PaymentBreakdownDTO(e.getKey(), (long) e.getValue()[0], e.getValue()[1], round1(pct));
                })
                .collect(Collectors.toList());
    }

    public double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    public double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
