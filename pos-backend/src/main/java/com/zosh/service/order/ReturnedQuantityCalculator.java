package com.zosh.service.order;

import com.zosh.modal.OrderItem;
import com.zosh.modal.Refund;
import com.zosh.modal.RefundItem;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tính số lượng CÒN LẠI (chưa hoàn trả) của từng OrderItem dựa trên các phiếu hoàn trước đó.
 * Dùng chung cho hoàn kho khi hủy/xóa đơn (OrderServiceImpl) và kiểm tra số lượng được phép hoàn (RefundServiceImpl).
 */
public final class ReturnedQuantityCalculator {

    private ReturnedQuantityCalculator() {
    }

    /**
     * @param items        danh sách OrderItem theo đúng thứ tự cần duyệt (thứ tự ảnh hưởng tới việc trừ fallback theo productId)
     * @param priorRefunds các phiếu hoàn trước đó (có thể null)
     * @return mảng số lượng còn lại, cùng chỉ số với {@code items}
     */
    public static int[] remainingQuantities(List<OrderItem> items, List<Refund> priorRefunds) {
        Map<Long, Integer> returnedByOrderItemId = new HashMap<>();
        Map<Long, Integer> returnedByProductId = new HashMap<>();
        collectReturnedQuantities(priorRefunds, returnedByOrderItemId, returnedByProductId);

        int[] remaining = new int[items.size()];
        for (int i = 0; i < items.size(); i++) {
            OrderItem item = items.get(i);
            int orderedQty = item.getQuantity() != null ? item.getQuantity() : 0;
            int alreadyQty = item.getId() != null ? returnedByOrderItemId.getOrDefault(item.getId(), 0) : 0;
            if (alreadyQty == 0 && item.getProduct() != null && item.getProduct().getId() != null) {
                alreadyQty = consumeProductFallback(returnedByProductId, item.getProduct().getId(), orderedQty);
            }
            remaining[i] = Math.max(0, orderedQty - alreadyQty);
        }
        return remaining;
    }

    /** Gom số lượng đã hoàn theo orderItemId; bản ghi cũ không có orderItemId thì gom theo productId. */
    private static void collectReturnedQuantities(List<Refund> priorRefunds,
                                                  Map<Long, Integer> byOrderItemId,
                                                  Map<Long, Integer> byProductId) {
        if (priorRefunds == null) {
            return;
        }
        for (Refund refund : priorRefunds) {
            if (refund.getItems() == null) continue;
            for (RefundItem ri : refund.getItems()) {
                int q = ri.getQuantity() != null ? ri.getQuantity() : 0;
                if (q <= 0) continue;
                if (ri.getOrderItemId() != null) {
                    byOrderItemId.merge(ri.getOrderItemId(), q, Integer::sum);
                } else if (ri.getProductId() != null) {
                    byProductId.merge(ri.getProductId(), q, Integer::sum);
                }
            }
        }
    }

    /** Trừ dần số lượng đã hoàn theo productId (tương thích dữ liệu cũ) cho từng dòng đơn. */
    private static int consumeProductFallback(Map<Long, Integer> returnedByProductId, Long productId, int orderedQty) {
        int fallback = returnedByProductId.getOrDefault(productId, 0);
        if (fallback <= 0) {
            return 0;
        }
        int consume = Math.min(orderedQty, fallback);
        returnedByProductId.put(productId, fallback - consume);
        return consume;
    }
}
