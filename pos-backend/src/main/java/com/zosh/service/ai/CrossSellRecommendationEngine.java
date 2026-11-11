package com.zosh.service.ai;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PlanFeature;
import com.zosh.mapper.ProductMapper;
import com.zosh.modal.*;
import com.zosh.payload.response.AiCopilotDTOs.CrossSellSuggestion;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.service.PlanLimitChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thuật toán gợi ý bán chéo (AI Cross-sell / Upsell) tại quầy POS:
 * kết hợp lịch sử mua của khách hàng, đồng xuất hiện trong đơn hàng 30 ngày gần nhất,
 * danh mục cửa hàng và kiểm tra tồn kho còn hàng tại chi nhánh.
 */
@Component
@RequiredArgsConstructor
public class CrossSellRecommendationEngine {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final PlanLimitChecker planLimitChecker;

    public List<CrossSellSuggestion> recommend(
            Long branchId,
            Store store,
            Long customerId,
            List<Long> cartProductIds
    ) {
        Set<Long> inCart = cartProductIds != null ? new HashSet<>(cartProductIds) : Collections.emptySet();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime thirtyDaysAgo = now.minusDays(30);

        // Chỉ lấy đơn hàng trong 30 ngày gần nhất để tối ưu RAM và tốc độ phản hồi tại quầy POS
        List<Order> branchOrders = branchId != null
                ? orderRepository.findByBranchIdAndCreatedAtBetween(branchId, thirtyDaysAgo, now)
                : (store != null ? orderRepository.findAllByStoreIdWithDetails(store.getId()) : Collections.emptyList());

        Map<Long, Integer> scoreByProductId = new HashMap<>();
        Map<Long, String> reasonByProductId = new HashMap<>();
        Map<Long, Product> productById = new HashMap<>();

        scoreFromCustomerHistory(customerId, store, inCart, scoreByProductId, reasonByProductId, productById);
        scoreFromRecentOrders(branchOrders, inCart, scoreByProductId, reasonByProductId, productById);
        backfillFromStoreCatalog(store, inCart, scoreByProductId, reasonByProductId, productById);
        filterInStockAtBranch(branchId, store, scoreByProductId);

        return scoreByProductId.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(3)
                .map(e -> CrossSellSuggestion.builder()
                        .product(ProductMapper.toDTO(productById.get(e.getKey())))
                        .reason(reasonByProductId.getOrDefault(e.getKey(), "Sản phẩm gợi ý mua kèm"))
                        .coOccurrenceScore(e.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    private void scoreFromCustomerHistory(
            Long customerId,
            Store store,
            Set<Long> inCart,
            Map<Long, Integer> scoreByProductId,
            Map<Long, String> reasonByProductId,
            Map<Long, Product> productById
    ) {
        if (customerId == null || store == null) {
            return;
        }
        final Long currentStoreId = store.getId();
        Customer cust = customerRepository.findById(customerId).orElse(null);
        // Kiểm tra khách hàng phải thuộc Store hiện tại
        if (cust == null || cust.getStore() == null || !cust.getStore().getId().equals(currentStoreId)) {
            return;
        }
        for (Order co : orderRepository.findByCustomerId(customerId)) {
            if (!isCompletedOrPartial(co) || co.getItems() == null) {
                continue;
            }
            for (OrderItem oi : co.getItems()) {
                Product p = oi.getProduct();
                if (p != null && p.getId() != null && !inCart.contains(p.getId())) {
                    productById.put(p.getId(), p);
                    int qty = oi.getQuantity() != null ? oi.getQuantity() : 1;
                    scoreByProductId.merge(p.getId(), qty * 5, Integer::sum);
                    reasonByProductId.putIfAbsent(p.getId(), "Khách hàng này thường xuyên mua trước đây");
                }
            }
        }
    }

    private void scoreFromRecentOrders(
            List<Order> branchOrders,
            Set<Long> inCart,
            Map<Long, Integer> scoreByProductId,
            Map<Long, String> reasonByProductId,
            Map<Long, Product> productById
    ) {
        for (Order o : branchOrders) {
            if (!isCompletedOrPartial(o) || o.getItems() == null) {
                continue;
            }
            Set<Long> orderProdIds = o.getItems().stream()
                    .filter(i -> i.getProduct() != null && i.getProduct().getId() != null)
                    .map(i -> i.getProduct().getId())
                    .collect(Collectors.toSet());

            boolean sharesItemWithCart = !inCart.isEmpty() && orderProdIds.stream().anyMatch(inCart::contains);
            for (OrderItem oi : o.getItems()) {
                Product p = oi.getProduct();
                if (p == null || p.getId() == null || inCart.contains(p.getId())) {
                    continue;
                }
                productById.putIfAbsent(p.getId(), p);
                int qty = oi.getQuantity() != null ? oi.getQuantity() : 1;
                if (sharesItemWithCart) {
                    scoreByProductId.merge(p.getId(), qty * 10, Integer::sum);
                    reasonByProductId.put(p.getId(), "Hay được mua kèm với sản phẩm đang có trong giỏ");
                } else {
                    scoreByProductId.merge(p.getId(), qty, Integer::sum);
                    reasonByProductId.putIfAbsent(p.getId(), "Sản phẩm bán chạy tại chi nhánh");
                }
            }
        }
    }

    private void backfillFromStoreCatalog(
            Store store,
            Set<Long> inCart,
            Map<Long, Integer> scoreByProductId,
            Map<Long, String> reasonByProductId,
            Map<Long, Product> productById
    ) {
        if (scoreByProductId.size() >= 3 || store == null) {
            return;
        }
        for (Product p : productRepository.findByStoreId(store.getId())) {
            if (!inCart.contains(p.getId()) && !scoreByProductId.containsKey(p.getId())) {
                productById.put(p.getId(), p);
                scoreByProductId.put(p.getId(), 1);
                reasonByProductId.put(p.getId(), "Gợi ý tư vấn thêm cùng danh mục cửa hàng");
            }
        }
    }

    private void filterInStockAtBranch(Long branchId, Store store, Map<Long, Integer> scoreByProductId) {
        // Chỉ giữ lại các sản phẩm có tồn kho > 0 tại chi nhánh hiện tại (nếu gói có hệ thống kho)
        if (branchId != null && planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)) {
            Set<Long> inStockProductIds = inventoryRepository.findByBranchId(branchId).stream()
                    .filter(inv -> inv.getProduct() != null && inv.getQuantity() != null && inv.getQuantity() > 0)
                    .map(inv -> inv.getProduct().getId())
                    .collect(Collectors.toSet());
            scoreByProductId.keySet().retainAll(inStockProductIds);
        }
    }

    private boolean isCompletedOrPartial(Order order) {
        return order != null
                && (order.getStatus() == null
                || order.getStatus() == OrderStatus.COMPLETED
                || order.getStatus() == OrderStatus.PARTIALLY_REFUNDED);
    }
}
