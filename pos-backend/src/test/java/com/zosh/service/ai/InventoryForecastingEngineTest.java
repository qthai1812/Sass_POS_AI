package com.zosh.service.ai;

import com.zosh.domain.OrderStatus;
import com.zosh.modal.Inventory;
import com.zosh.modal.Order;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Product;
import com.zosh.payload.response.AiCopilotDTOs.CouponSuggestion;
import com.zosh.payload.response.AiCopilotDTOs.RestockSuggestion;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.service.ai.InventoryForecastingEngine.BranchForecast;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryForecastingEngineTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private OrderRepository orderRepository;

    @InjectMocks
    private InventoryForecastingEngine forecastingEngine;

    @Test
    void forecastForBranch_identifiesUrgentRestockAndOverstockCoupons() {
        Product hotShirt = Product.builder().id(1L).name("Áo Polo").sku("POLO-01").sellingPrice(200000.0).build();
        Product slowCoat = Product.builder().id(2L).name("Áo Khoác Đông").sku("COAT-WINTER-99").sellingPrice(500000.0).build();

        Inventory lowInv = Inventory.builder().id(10L).product(hotShirt).quantity(0).minStockLevel(10).build();
        Inventory highVelocityInv = Inventory.builder().id(11L).product(
                Product.builder().id(3L).name("Quần Jean").sku("JEAN-1").build()
        ).quantity(12).minStockLevel(5).build();
        Inventory slowInv = Inventory.builder().id(12L).product(slowCoat).quantity(40).minStockLevel(10).build();

        Product jean = highVelocityInv.getProduct();
        Order completedOrder = Order.builder()
                .id(100L)
                .status(OrderStatus.COMPLETED)
                .items(List.of(
                        OrderItem.builder().product(hotShirt).quantity(8).build(),
                        OrderItem.builder().product(jean).quantity(10).build(),
                        OrderItem.builder().product(slowCoat).quantity(1).build()
                ))
                .build();
        // Cancelled order must be excluded from 30-day sales velocity
        Order cancelledOrder = Order.builder()
                .id(101L)
                .status(OrderStatus.CANCELLED)
                .items(List.of(OrderItem.builder().product(slowCoat).quantity(50).build()))
                .build();

        when(inventoryRepository.findByBranchId(1L)).thenReturn(List.of(highVelocityInv, lowInv, slowInv));
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(1L), any(), any()))
                .thenReturn(List.of(completedOrder, cancelledOrder));

        BranchForecast forecast = forecastingEngine.forecastForBranch(1L, "Chi nhánh Q1");

        List<RestockSuggestion> restocks = forecast.restockSuggestions();
        assertEquals(2, restocks.size());
        // Sorted ascending by currentStock -> 0 stock first (HIGH urgency)
        assertEquals(1L, restocks.get(0).getProductId());
        assertEquals("HIGH", restocks.get(0).getUrgency());
        assertEquals(30, restocks.get(0).getSuggestedRestockQty());
        assertEquals(3L, restocks.get(1).getProductId());

        List<CouponSuggestion> coupons = forecast.couponSuggestions();
        assertEquals(1, coupons.size());
        assertEquals("XACOATWI15", coupons.get(0).getSuggestedCode());
        assertEquals(15.0, coupons.get(0).getDiscountValue());
        assertEquals(750000.0, coupons.get(0).getMinOrderValue());
    }

    @Test
    void forecastForBranch_noOverstockProducts_returnsDefaultCombo10Coupon() {
        when(inventoryRepository.findByBranchId(2L)).thenReturn(List.of());
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(2L), any(), any())).thenReturn(List.of());

        BranchForecast forecast = forecastingEngine.forecastForBranch(2L, "Chi nhánh Q3");

        assertTrue(forecast.restockSuggestions().isEmpty());
        assertEquals(1, forecast.couponSuggestions().size());
        assertEquals("COMBO10", forecast.couponSuggestions().get(0).getSuggestedCode());
    }
}
