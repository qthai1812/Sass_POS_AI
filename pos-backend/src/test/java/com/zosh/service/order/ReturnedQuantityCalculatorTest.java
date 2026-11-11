package com.zosh.service.order;

import com.zosh.modal.OrderItem;
import com.zosh.modal.Product;
import com.zosh.modal.Refund;
import com.zosh.modal.RefundItem;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

class ReturnedQuantityCalculatorTest {

    private OrderItem orderItem(Long id, Long productId, int qty) {
        return OrderItem.builder()
                .id(id)
                .product(Product.builder().id(productId).name("Item " + productId).build())
                .quantity(qty)
                .build();
    }

    @Test
    void remainingQuantities_noPriorRefunds_returnsFullQuantities() {
        List<OrderItem> items = List.of(
                orderItem(10L, 1L, 3),
                orderItem(11L, 2L, 5)
        );

        int[] result = ReturnedQuantityCalculator.remainingQuantities(items, Collections.emptyList());

        assertArrayEquals(new int[]{3, 5}, result);
    }

    @Test
    void remainingQuantities_withOrderItemIdMatches_deductsExactQuantities() {
        List<OrderItem> items = List.of(
                orderItem(10L, 1L, 4),
                orderItem(11L, 2L, 2)
        );
        Refund r1 = Refund.builder()
                .items(List.of(
                        RefundItem.builder().orderItemId(10L).productId(1L).quantity(1).build(),
                        RefundItem.builder().orderItemId(11L).productId(2L).quantity(2).build()
                ))
                .build();
        Refund r2 = Refund.builder()
                .items(List.of(
                        RefundItem.builder().orderItemId(10L).productId(1L).quantity(2).build()
                ))
                .build();

        int[] result = ReturnedQuantityCalculator.remainingQuantities(items, List.of(r1, r2));

        assertArrayEquals(new int[]{1, 0}, result);
    }

    @Test
    void remainingQuantities_legacyRefundWithoutOrderItemId_fallsBackToProductId() {
        List<OrderItem> items = List.of(
                orderItem(10L, 100L, 2),
                orderItem(11L, 100L, 3)
        );
        Refund legacyRefund = Refund.builder()
                .items(List.of(
                        RefundItem.builder().orderItemId(null).productId(100L).quantity(3).build()
                ))
                .build();

        int[] result = ReturnedQuantityCalculator.remainingQuantities(items, List.of(legacyRefund));

        assertArrayEquals(new int[]{0, 2}, result);
    }

    @Test
    void remainingQuantities_overReturnedClampedToZero() {
        List<OrderItem> items = List.of(orderItem(10L, 1L, 2));
        Refund refund = Refund.builder()
                .items(List.of(RefundItem.builder().orderItemId(10L).quantity(5).build()))
                .build();

        int[] result = ReturnedQuantityCalculator.remainingQuantities(items, List.of(refund));

        assertArrayEquals(new int[]{0}, result);
    }
}
