package com.zosh.service.ai;

import com.zosh.domain.OrderStatus;
import com.zosh.modal.Inventory;
import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.payload.response.AiCopilotDTOs.CouponSuggestion;
import com.zosh.payload.response.AiCopilotDTOs.RestockSuggestion;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dự báo nhập kho (smart restock) và gợi ý mã giảm giá xả tồn (slow-moving coupon)
 * dựa trên tồn kho hiện tại và sản lượng bán 30 ngày gần nhất tại từng chi nhánh.
 */
@Component
@RequiredArgsConstructor
public class InventoryForecastingEngine {

    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;

    public record BranchForecast(
            List<RestockSuggestion> restockSuggestions,
            List<CouponSuggestion> couponSuggestions
    ) {
    }

    public BranchForecast forecastForBranch(Long branchId, String branchName) {
        List<Inventory> inventories = inventoryRepository.findByBranchId(branchId);
        Map<Long, Long> soldQtyMap = build30DaySoldQuantityMap(branchId);
        return new BranchForecast(
                buildRestockSuggestions(branchId, branchName, inventories, soldQtyMap),
                buildCouponSuggestions(branchName, inventories, soldQtyMap)
        );
    }

    public List<RestockSuggestion> computeRestockForBranch(Long branchId, String branchName) {
        return buildRestockSuggestions(
                branchId, branchName,
                inventoryRepository.findByBranchId(branchId),
                build30DaySoldQuantityMap(branchId)
        );
    }

    public List<CouponSuggestion> computeCouponForBranch(Long branchId, String branchName) {
        return buildCouponSuggestions(
                branchName,
                inventoryRepository.findByBranchId(branchId),
                build30DaySoldQuantityMap(branchId)
        );
    }

    private Map<Long, Long> build30DaySoldQuantityMap(Long branchId) {
        LocalDateTime now = LocalDateTime.now();
        List<Order> orders = orderRepository
                .findByBranchIdAndCreatedAtBetween(branchId, now.minusDays(30), now)
                .stream()
                .filter(o -> o.getStatus() == null || o.getStatus() == OrderStatus.COMPLETED)
                .collect(Collectors.toList());

        Map<Long, Long> soldQtyMap = new HashMap<>();
        for (Order o : orders) {
            if (o.getItems() == null) {
                continue;
            }
            for (OrderItem oi : o.getItems()) {
                if (oi.getProduct() != null && oi.getProduct().getId() != null) {
                    soldQtyMap.merge(
                            oi.getProduct().getId(),
                            oi.getQuantity() != null ? oi.getQuantity().longValue() : 0L,
                            Long::sum
                    );
                }
            }
        }
        return soldQtyMap;
    }

    private List<RestockSuggestion> buildRestockSuggestions(
            Long branchId,
            String branchName,
            List<Inventory> inventories,
            Map<Long, Long> soldQtyMap
    ) {
        List<RestockSuggestion> result = new ArrayList<>();
        for (Inventory inv : inventories) {
            if (inv.getProduct() == null) {
                continue;
            }
            int qty = inv.getQuantity() != null ? inv.getQuantity() : 0;
            int minLevel = inv.getMinStockLevel() != null ? inv.getMinStockLevel() : 10;
            long sold = soldQtyMap.getOrDefault(inv.getProduct().getId(), 0L);

            if (qty <= minLevel || (sold >= 5 && qty <= sold * 1.5)) {
                int targetStock = Math.max(minLevel * 3, (int) Math.max(20, sold * 2));
                int suggestedAdd = Math.max(10, targetStock - qty);
                String urgency = (qty == 0 || qty <= minLevel / 2) ? "HIGH" : "MEDIUM";
                String reason = qty <= minLevel
                        ? ("Tồn kho hiện tại (" + qty + ") đã dưới mức tối thiểu (" + minLevel + "), đã bán " + sold + " SP.")
                        : ("Tốc độ bán cao (" + sold + " SP) có nguy cơ hết hàng sớm.");

                result.add(RestockSuggestion.builder()
                        .branchId(branchId)
                        .branchName(branchName)
                        .productId(inv.getProduct().getId())
                        .productName(inv.getProduct().getName())
                        .sku(inv.getProduct().getSku())
                        .currentStock(qty)
                        .minStockLevel(minLevel)
                        .soldQuantity(sold)
                        .suggestedRestockQty(suggestedAdd)
                        .urgency(urgency)
                        .reason(reason)
                        .build());
            }
        }
        result.sort(Comparator.comparingInt(RestockSuggestion::getCurrentStock));
        return result;
    }

    private List<CouponSuggestion> buildCouponSuggestions(
            String branchName,
            List<Inventory> inventories,
            Map<Long, Long> soldQtyMap
    ) {
        List<CouponSuggestion> suggestions = new ArrayList<>();
        for (Inventory inv : inventories) {
            if (inv.getProduct() == null) {
                continue;
            }
            int qty = inv.getQuantity() != null ? inv.getQuantity() : 0;
            int minLevel = inv.getMinStockLevel() != null ? inv.getMinStockLevel() : 10;
            long sold = soldQtyMap.getOrDefault(inv.getProduct().getId(), 0L);

            if (qty >= Math.max(20, minLevel * 2) && sold <= 2) {
                String cleanSku = inv.getProduct().getSku() != null
                        ? inv.getProduct().getSku().replaceAll("[^A-Za-z0-9]", "").toUpperCase()
                        : "SALE";
                if (cleanSku.length() > 6) {
                    cleanSku = cleanSku.substring(0, 6);
                }
                double price = inv.getProduct().getSellingPrice() != null ? inv.getProduct().getSellingPrice() : 50000.0;

                suggestions.add(CouponSuggestion.builder()
                        .suggestedCode("XA" + cleanSku + "15")
                        .discountType("PERCENTAGE")
                        .discountValue(15.0)
                        .minOrderValue((double) Math.round(price * 1.5 / 1000.0) * 1000.0)
                        .targetProductOrCategory(inv.getProduct().getName())
                        .reason("Tồn kho tại " + branchName + " còn " + qty + " SP nhưng mới bán được " + sold
                                + " SP. Nên tạo mã giảm 15% để kích cầu xả hàng.")
                        .build());
            }
        }
        if (suggestions.isEmpty()) {
            suggestions.add(CouponSuggestion.builder()
                    .suggestedCode("COMBO10")
                    .discountType("PERCENTAGE")
                    .discountValue(10.0)
                    .minOrderValue(100000.0)
                    .targetProductOrCategory("Đơn hàng từ 100.000đ")
                    .reason("Gợi ý mã khuyến mãi kích cầu mua thêm (Upsell) cho các đơn hàng từ 100.000đ.")
                    .build());
        }
        return suggestions.stream().limit(3).collect(Collectors.toList());
    }
}
