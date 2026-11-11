package com.zosh.service.order;

import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Refund;
import com.zosh.service.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Điều phối trừ/hoàn tồn kho cho đơn hàng và phiếu hoàn.
 * Luôn xử lý theo productId tăng dần để tránh deadlock khi lock bi quan bảng inventory.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderInventoryCoordinator {

    private final InventoryService inventoryService;

    /** Trừ kho cho toàn bộ dòng sản phẩm của đơn mới. */
    public void deductForItems(List<OrderItem> items, Long branchId) throws Exception {
        for (OrderItem item : sortByProductId(items)) {
            Long productId = item.getProduct().getId();
            try {
                inventoryService.deductInventory(productId, branchId, item.getQuantity());
            } catch (Exception e) {
                throw new Exception("Failed to deduct inventory for product id " + productId + ": " + e.getMessage());
            }
        }
    }

    /** Hoàn kho các sản phẩm trong đơn, trừ đi số lượng đã hoàn kho ở các lần hoàn tiền một phần trước đó. */
    public void restoreRemainingForOrder(Order order, List<Refund> priorRefunds) {
        if (order.getBranch() == null || order.getItems() == null) {
            return;
        }
        List<OrderItem> sortedItems = sortByProductId(order.getItems());
        int[] remaining = ReturnedQuantityCalculator.remainingQuantities(sortedItems, priorRefunds);
        for (int i = 0; i < sortedItems.size(); i++) {
            if (remaining[i] <= 0) continue;
            OrderItem item = sortedItems.get(i);
            try {
                inventoryService.restoreInventory(item.getProduct().getId(), order.getBranch().getId(), remaining[i]);
            } catch (Exception e) {
                log.warn("Could not restore inventory for product {} of order {}: {}",
                        item.getProduct().getId(), order.getId(), e.getMessage());
            }
        }
    }

    /** Cộng kho theo productId (map đã sắp xếp tăng dần) khi tạo phiếu hoàn. */
    public void restoreByProduct(Map<Long, Integer> qtyByProductId, Long branchId, Long orderId) throws Exception {
        for (Map.Entry<Long, Integer> entry : qtyByProductId.entrySet()) {
            int qty = entry.getValue();
            if (qty <= 0) continue;
            inventoryService.restoreInventory(entry.getKey(), branchId, qty);
            log.info("Restored {} units of product {} to branch {} for refund on order {}",
                    qty, entry.getKey(), branchId, orderId);
        }
    }

    /** Trừ kho theo productId (map đã sắp xếp tăng dần) khi xóa phiếu hoàn. */
    public void deductByProduct(Map<Long, Integer> qtyByProductId, Long branchId) throws Exception {
        for (Map.Entry<Long, Integer> entry : qtyByProductId.entrySet()) {
            inventoryService.deductInventory(entry.getKey(), branchId, entry.getValue());
        }
    }

    /** Trừ lại toàn bộ số lượng của đơn (tương thích bản ghi Refund cũ không có RefundItem). */
    public void deductAllOrderItems(Order order) throws Exception {
        for (OrderItem item : sortByProductId(order.getItems())) {
            inventoryService.deductInventory(item.getProduct().getId(), order.getBranch().getId(), item.getQuantity());
        }
    }

    private List<OrderItem> sortByProductId(List<OrderItem> items) {
        return items.stream()
                .filter(i -> i.getProduct() != null && i.getProduct().getId() != null)
                .sorted(Comparator.comparing(i -> i.getProduct().getId()))
                .collect(Collectors.toList());
    }
}
