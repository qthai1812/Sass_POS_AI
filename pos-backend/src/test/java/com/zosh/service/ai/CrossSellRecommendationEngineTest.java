package com.zosh.service.ai;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PlanFeature;
import com.zosh.modal.*;
import com.zosh.payload.response.AiCopilotDTOs.CrossSellSuggestion;
import com.zosh.repository.*;
import com.zosh.service.PlanLimitChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrossSellRecommendationEngineTest {

    @Mock private OrderRepository orderRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private ProductRepository productRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private PlanLimitChecker planLimitChecker;

    @InjectMocks
    private CrossSellRecommendationEngine engine;

    private Store store;
    private Product shirt;
    private Product belt;
    private Product socks;
    private Product cap;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        shirt = Product.builder().id(10L).name("Áo Sơ Mi").store(store).build();
        belt = Product.builder().id(20L).name("Thắt Lưng Da").store(store).build();
        socks = Product.builder().id(30L).name("Tất Cotton").store(store).build();
        cap = Product.builder().id(40L).name("Mũ Lưỡi Trai").store(store).build();
    }

    @Test
    void recommend_weightsCoOccurrenceAndCustomerHistoryAndFiltersOutOfStock() {
        Customer vip = Customer.builder().id(500L).store(store).fullName("Lan").build();
        when(customerRepository.findById(500L)).thenReturn(Optional.of(vip));
        // History shows customer bought socks (qty 2 -> +10 points)
        when(orderRepository.findByCustomerId(500L)).thenReturn(List.of(
                Order.builder().id(1L).status(OrderStatus.COMPLETED)
                        .items(List.of(OrderItem.builder().product(socks).quantity(2).build()))
                        .build()
        ));

        // Basket has shirt (10L); co-occurring order has shirt + belt (qty 2 -> +20 points) + cap (out of stock!)
        Order coOrder = Order.builder().id(2L).status(OrderStatus.COMPLETED)
                .items(List.of(
                        OrderItem.builder().product(shirt).quantity(1).build(),
                        OrderItem.builder().product(belt).quantity(2).build(),
                        OrderItem.builder().product(cap).quantity(5).build()
                ))
                .build();
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(5L), any(), any())).thenReturn(List.of(coOrder));

        when(planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)).thenReturn(true);
        // cap has 0 inventory -> must be filtered out even with high score
        when(inventoryRepository.findByBranchId(5L)).thenReturn(List.of(
                Inventory.builder().product(belt).quantity(4).build(),
                Inventory.builder().product(socks).quantity(10).build(),
                Inventory.builder().product(cap).quantity(0).build()
        ));

        List<CrossSellSuggestion> suggestions = engine.recommend(5L, store, 500L, List.of(10L));

        assertEquals(2, suggestions.size());
        assertEquals(20L, suggestions.get(0).getProduct().getId());
        assertEquals(20, suggestions.get(0).getCoOccurrenceScore());
        assertEquals(30L, suggestions.get(1).getProduct().getId());
        assertEquals(10, suggestions.get(1).getCoOccurrenceScore());
    }

    @Test
    void recommend_ignoresCustomerFromAnotherStoreAndBackfillsFromCatalog() {
        Store otherStore = new Store();
        otherStore.setId(99L);
        Customer outsider = Customer.builder().id(77L).store(otherStore).build();

        when(customerRepository.findById(77L)).thenReturn(Optional.of(outsider));
        when(orderRepository.findAllByStoreIdWithDetails(1L)).thenReturn(List.of());
        when(productRepository.findByStoreId(1L)).thenReturn(List.of(shirt, belt, socks, cap));

        List<CrossSellSuggestion> suggestions = engine.recommend(null, store, 77L, List.of(10L));

        assertEquals(3, suggestions.size());
        assertFalse(suggestions.stream().anyMatch(s -> s.getProduct().getId().equals(10L)));
    }
}
