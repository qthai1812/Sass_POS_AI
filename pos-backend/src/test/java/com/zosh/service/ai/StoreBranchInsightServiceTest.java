package com.zosh.service.ai;

import com.zosh.modal.*;
import com.zosh.payload.dto.BranchDTO;
import com.zosh.payload.response.*;
import com.zosh.payload.response.AiCopilotDTOs.AiInsightResponse;
import com.zosh.payload.response.AiCopilotDTOs.CouponSuggestion;
import com.zosh.payload.response.AiCopilotDTOs.RestockSuggestion;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.RefundRepository;
import com.zosh.service.BranchAnalyticsService;
import com.zosh.service.StoreAnalyticsService;
import com.zosh.service.ai.InventoryForecastingEngine.BranchForecast;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreBranchInsightServiceTest {

    @Mock private StoreAnalyticsService storeAnalyticsService;
    @Mock private BranchAnalyticsService branchAnalyticsService;
    @Mock private BranchRepository branchRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private InventoryForecastingEngine forecastingEngine;
    @Mock private GeminiClient geminiClient;

    @InjectMocks
    private StoreBranchInsightService insightService;

    @Test
    void buildStoreInsight_fallsBackToBuiltInSummaryAndDetectsRefundRisk() throws Exception {
        Store store = new Store();
        store.setId(1L);
        store.setBrand("Zosh Boutique");

        Branch branch = Branch.builder().id(10L).name("Q1").store(store).build();
        User cashier = new User();
        cashier.setId(50L);
        cashier.setFullName("Trần Lan");

        when(storeAnalyticsService.getStoreOverview(9L))
                .thenReturn(new StoreOverviewDTO(1200000.0, 6, 1, 20, 4, 200000.0, 20.0));
        when(storeAnalyticsService.getBranchPerformance(9L))
                .thenReturn(List.of(new BranchPerformanceDTO(10L, "Q1", 1200000.0, 6, 4, 200000.0)));
        when(storeAnalyticsService.getStoreAlerts(9L))
                .thenReturn(StoreAlertsDTO.builder()
                        .noSaleToday(List.of(BranchDTO.builder().id(11L).name("Q7").build()))
                        .inactiveCashiers(List.of())
                        .build());
        when(refundRepository.findByBranchStoreId(1L)).thenReturn(List.of(
                Refund.builder().id(1L).cashier(cashier).amount(150000.0).createdAt(LocalDateTime.now().minusDays(1)).build()
        ));
        when(branchRepository.findByStoreId(1L)).thenReturn(List.of(branch));
        when(forecastingEngine.forecastForBranch(10L, "Q1")).thenReturn(new BranchForecast(
                List.of(RestockSuggestion.builder().productId(1L).currentStock(2).build()),
                List.of(CouponSuggestion.builder().suggestedCode("XA01").build())
        ));
        when(geminiClient.tryGenerateSummary(anyString())).thenReturn(null);

        AiInsightResponse response = insightService.buildStoreInsight(store, 9L);

        assertEquals("STORE", response.getScope());
        assertEquals("POS Smart Analytics Engine", response.getGeneratedBy());
        assertTrue(response.getExecutiveSummary().contains("Zosh Boutique"));
        assertTrue(response.getRiskAlerts().stream().anyMatch(r -> r.contains("Trần Lan")));
        assertEquals(1, response.getRestockSuggestions().size());
        assertEquals(1, response.getCouponSuggestions().size());
    }

    @Test
    void buildBranchInsight_usesGeminiSummaryWhenAvailable() {
        Store store = new Store();
        store.setId(1L);
        Branch branch = Branch.builder().id(10L).name("CN Hai Bà Trưng").store(store).build();

        when(branchAnalyticsService.getTodayOverview(10L))
                .thenReturn(new BranchOverviewDTO(500000.0, 4, 0.0, 1, 2, 125000.0));
        when(branchAnalyticsService.getDailySalesChart(10L, 7))
                .thenReturn(List.of(new DailySalesDTO("2026-11-11", 3000000.0, 20)));
        when(branchAnalyticsService.getTopProductsByQuantity(10L))
                .thenReturn(List.of(new TopProductDTO(1L, "Áo Len", "LEN-1", 15L, 2000000.0, 40.0)));
        when(branchAnalyticsService.getTopCashiersByRevenue(10L))
                .thenReturn(List.of(new TopCashierDTO(2L, "Minh", 2500000.0, 15)));
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of());
        when(forecastingEngine.forecastForBranch(10L, "CN Hai Bà Trưng"))
                .thenReturn(new BranchForecast(
                        List.of(),
                        List.of(CouponSuggestion.builder().suggestedCode("BRANCH50").build())
                ));
        when(geminiClient.tryGenerateSummary(anyString())).thenReturn("Nhận xét từ Gemini AI");

        AiInsightResponse response = insightService.buildBranchInsight(branch);

        assertEquals("BRANCH", response.getScope());
        assertEquals("Gemini AI + POS Data", response.getGeneratedBy());
        assertEquals("Nhận xét từ Gemini AI", response.getExecutiveSummary());
        assertTrue(response.getCouponSuggestions().isEmpty());
        assertFalse(response.getActionItems().stream()
                .anyMatch(a -> a.toLowerCase().contains("mã giảm giá")));
        assertTrue(response.getRiskAlerts().stream().anyMatch(r -> r.contains("2 mặt hàng")));
    }
}
