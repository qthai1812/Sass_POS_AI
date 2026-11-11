package com.zosh.service.shift;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.modal.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tính toán các chỉ số tổng hợp của ca làm việc (doanh thu gộp, hoàn tiền, doanh thu thuần,
 * phân bổ phương thức thanh toán, top 5 sản phẩm bán chạy và 5 đơn gần nhất).
 */
@Component
public class ShiftMetricsCalculator {

    public record ShiftMetrics(double totalSales, double totalRefunds, double netSales, int totalOrders) {
    }

    /**
     * Doanh thu gộp của ca gồm các đơn đã thu tiền trong ca: COMPLETED, PARTIALLY_REFUNDED và REFUNDED
     * (đơn REFUNDED đã từng thu tiền thành công; khoản hoàn được trừ riêng ở ca phát sinh phiếu hoàn).
     * Loại bỏ đơn PENDING (chưa thanh toán) và CANCELLED (đã hủy).
     */
    public boolean isCompletedSalesOrder(Order order) {
        return order != null
                && (order.getStatus() == null
                || order.getStatus() == OrderStatus.COMPLETED
                || order.getStatus() == OrderStatus.PARTIALLY_REFUNDED
                || order.getStatus() == OrderStatus.REFUNDED);
    }

    public List<Order> filterValidSalesOrders(List<Order> orders) {
        if (orders == null) {
            return Collections.emptyList();
        }
        return orders.stream()
                .filter(this::isCompletedSalesOrder)
                .collect(Collectors.toList());
    }

    public ShiftMetrics calculateAndAttach(ShiftReport shiftReport, List<Order> orders, List<Refund> refunds) {
        List<Order> completedOrders = filterValidSalesOrders(orders);
        double totalSales = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();
        int totalOrders = completedOrders.size();
        double totalRefunds = refunds == null ? 0.0 : refunds.stream()
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();
        double netSales = computeNetSales(totalSales, totalRefunds);

        shiftReport.setRecentOrders(getRecentOrders(orders));
        shiftReport.setTopSellingProducts(computeTopSellingProducts(orders));
        shiftReport.setPaymentSummaries(computePaymentSummaries(orders));

        return new ShiftMetrics(totalSales, totalRefunds, netSales, totalOrders);
    }

    /**
     * Net Sales của ca = doanh thu gộp (đơn COMPLETED + REFUNDED thu tiền trong ca)
     * trừ tổng các phiếu hoàn tiền phát sinh TRONG ca này (liên kết qua shiftReportId).
     * Mỗi khoản hoàn chỉ bị trừ đúng 1 lần ở ca phát sinh, dù đơn gốc thuộc ca nào.
     */
    public double computeNetSales(double grossShiftSales, double shiftRefundsTotal) {
        return grossShiftSales - shiftRefundsTotal;
    }

    public List<PaymentSummary> computePaymentSummaries(List<Order> orders) {
        List<Order> completedOrders = filterValidSalesOrders(orders);
        double completedTotal = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();
        Map<PaymentType, List<Order>> grouped = completedOrders.stream()
                .collect(Collectors.groupingBy(
                        order -> order.getPaymentType() != null ? order.getPaymentType() : PaymentType.CASH
                ));

        List<PaymentSummary> summaries = new ArrayList<>();
        for (Map.Entry<PaymentType, List<Order>> entry : grouped.entrySet()) {
            double amount = entry.getValue().stream()
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                    .sum();
            int transactions = entry.getValue().size();
            double percent = completedTotal > 0 ? (amount / completedTotal) * 100.0 : 0.0;

            PaymentSummary ps = new PaymentSummary();
            ps.setType(entry.getKey());
            ps.setTotalAmount(amount);
            ps.setTransactionCount(transactions);
            ps.setPercentage(percent);
            summaries.add(ps);
        }
        return summaries;
    }

    public List<Product> computeTopSellingProducts(List<Order> orders) {
        List<Order> validOrders = filterValidSalesOrders(orders);
        Map<Long, Product> productMap = new HashMap<>();
        Map<Long, Integer> productSalesMap = new HashMap<>();
        for (Order order : validOrders) {
            if (order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                Product product = item.getProduct();
                if (product != null && product.getId() != null) {
                    productMap.putIfAbsent(product.getId(), product);
                    int qty = item.getQuantity() != null ? item.getQuantity() : 0;
                    productSalesMap.put(product.getId(), productSalesMap.getOrDefault(product.getId(), 0) + qty);
                }
            }
        }
        return productSalesMap.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(entry -> buildTopProductSnapshot(productMap.get(entry.getKey()), entry.getValue()))
                .collect(Collectors.toList());
    }

    public List<Order> getRecentOrders(List<Order> orders) {
        if (orders == null) {
            return Collections.emptyList();
        }
        return orders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .collect(Collectors.toList());
    }

    private Product buildTopProductSnapshot(Product p, int soldQty) {
        return Product.builder()
                .id(p.getId())
                .name(p.getName())
                .sku(p.getSku())
                .description(p.getDescription())
                .mrp(p.getMrp())
                .sellingPrice(p.getSellingPrice())
                .brand(p.getBrand())
                .color(p.getColor())
                .image(p.getImage())
                .quantity(soldQty)
                .category(p.getCategory())
                .store(p.getStore())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
