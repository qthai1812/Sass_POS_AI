package com.zosh.service.order;

import com.zosh.modal.*;
import com.zosh.service.InventoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderInventoryCoordinatorTest {

    @Mock
    private InventoryService inventoryService;

    @InjectMocks
    private OrderInventoryCoordinator coordinator;

    @Test
    void deductForItems_deductsInAscendingProductIdOrderToPreventDeadlocks() throws Exception {
        OrderItem itemHigh = OrderItem.builder()
                .product(Product.builder().id(50L).build())
                .quantity(2)
                .build();
        OrderItem itemLow = OrderItem.builder()
                .product(Product.builder().id(10L).build())
                .quantity(3)
                .build();

        coordinator.deductForItems(List.of(itemHigh, itemLow), 99L);

        InOrder inOrder = inOrder(inventoryService);
        inOrder.verify(inventoryService).deductInventory(10L, 99L, 3);
        inOrder.verify(inventoryService).deductInventory(50L, 99L, 2);
    }

    @Test
    void deductForItems_wrapsFailureWithProductIdContext() throws Exception {
        OrderItem item = OrderItem.builder()
                .product(Product.builder().id(15L).build())
                .quantity(4)
                .build();
        doThrow(new RuntimeException("Out of stock")).when(inventoryService).deductInventory(15L, 1L, 4);

        assertThrows(Exception.class, () -> coordinator.deductForItems(List.of(item), 1L));
    }

    @Test
    void restoreRemainingForOrder_onlyRestoresUnreturnedQuantitiesInAscendingOrder() throws Exception {
        Branch branch = Branch.builder().id(5L).build();
        OrderItem oi1 = OrderItem.builder().id(101L).product(Product.builder().id(30L).build()).quantity(4).build();
        OrderItem oi2 = OrderItem.builder().id(102L).product(Product.builder().id(10L).build()).quantity(2).build();
        Order order = Order.builder().id(1L).branch(branch).items(List.of(oi1, oi2)).build();

        Refund prior = Refund.builder()
                .items(List.of(
                        RefundItem.builder().orderItemId(101L).productId(30L).quantity(1).build(),
                        RefundItem.builder().orderItemId(102L).productId(10L).quantity(2).build()
                ))
                .build();

        coordinator.restoreRemainingForOrder(order, List.of(prior));

        verify(inventoryService, never()).restoreInventory(eq(10L), anyLong(), anyInt());
        verify(inventoryService).restoreInventory(30L, 5L, 3);
    }

    @Test
    void restoreRemainingForOrder_doesNotPropagateExceptionOnFailure() throws Exception {
        Branch branch = Branch.builder().id(5L).build();
        OrderItem oi = OrderItem.builder().id(101L).product(Product.builder().id(10L).build()).quantity(1).build();
        Order order = Order.builder().id(1L).branch(branch).items(List.of(oi)).build();

        doThrow(new RuntimeException("DB glitch")).when(inventoryService).restoreInventory(10L, 5L, 1);

        assertDoesNotThrow(() -> coordinator.restoreRemainingForOrder(order, List.of()));
    }
}
