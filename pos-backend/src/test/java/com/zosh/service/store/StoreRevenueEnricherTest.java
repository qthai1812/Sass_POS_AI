package com.zosh.service.store;

import com.zosh.modal.Store;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreRevenueEnricherTest {

    @Mock private OrderRepository orderRepository;
    @Mock private RefundRepository refundRepository;

    @InjectMocks
    private StoreRevenueEnricher enricher;

    @Test
    void enrich_nullDto_returnsNull() {
        assertNull(enricher.enrich(null, 100000.0));
    }

    @Test
    void enrich_negativeRevenue_clampsToZeroWithDefaultRate() {
        StoreDTO dto = new StoreDTO();
        StoreDTO result = enricher.enrich(dto, -5000.0);

        assertEquals(0.0, result.getTotalRevenue());
        assertEquals(0.0, result.getTotalEarnings());
    }

    @Test
    void enrich_computesRoundedCommissionEarnings() {
        StoreDTO dto = new StoreDTO();
        dto.setCommissionRate(3.0);

        enricher.enrich(dto, 123456.78);

        assertEquals(123456.78, dto.getTotalRevenue());
        assertEquals(3703.7, dto.getTotalEarnings());
    }

    @Test
    void toEnrichedDTOList_subtractsPartialRefundsPerStore() {
        Store s1 = new Store();
        s1.setId(1L);
        s1.setBrand("Store A");
        s1.setCommissionRate(2.5);

        Store s2 = new Store();
        s2.setId(2L);
        s2.setBrand("Store B");
        s2.setCommissionRate(4.0);

        when(orderRepository.sumCompletedSalesGroupedByStore()).thenReturn(List.of(
                new Object[]{1L, 1000000.0},
                new Object[]{2L, 500000.0}
        ));
        when(refundRepository.sumRefundsOnCompletedOrdersGroupedByStore()).thenReturn(Collections.singletonList(
                new Object[]{1L, 250000.0}
        ));

        List<StoreDTO> results = enricher.toEnrichedDTOList(List.of(s1, s2));

        assertEquals(2, results.size());
        assertEquals(750000.0, results.get(0).getTotalRevenue());
        assertEquals(18750.0, results.get(0).getTotalEarnings());
        assertEquals(500000.0, results.get(1).getTotalRevenue());
        assertEquals(20000.0, results.get(1).getTotalEarnings());
    }
}
