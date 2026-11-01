package com.zosh.controller;

import com.zosh.payload.response.*;
import com.zosh.service.StoreAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/store/analytics")
public class StoreAnalyticsController {

    private final StoreAnalyticsService storeAnalyticsService;

    @GetMapping("/{storeAdminId}/overview")
    public ResponseEntity<StoreOverviewDTO> getStoreOverview(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getStoreOverview(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/sales-trends")
    public ResponseEntity<List<SalesTrendDTO>> getSalesTrends(
            @PathVariable Long storeAdminId,
            @RequestParam(defaultValue = "monthly") String period) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getSalesTrends(storeAdminId, period));
    }

    @GetMapping("/{storeAdminId}/sales/daily")
    public ResponseEntity<List<DailySalesDTO>> getDailySales(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getDailySales(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/sales/monthly")
    public ResponseEntity<List<DailySalesDTO>> getMonthlySales(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getMonthlySales(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/sales/category")
    public ResponseEntity<List<CategorySalesDTO>> getSalesByCategory(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getSalesByCategory(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/sales/payment-method")
    public ResponseEntity<List<PaymentBreakdownDTO>> getSalesByPaymentMethod(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getSalesByPaymentMethod(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/sales/branch")
    public ResponseEntity<List<BranchPerformanceDTO>> getSalesByBranch(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getSalesByBranch(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/payments")
    public ResponseEntity<List<PaymentBreakdownDTO>> getPaymentBreakdown(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getPaymentBreakdown(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/branch-performance")
    public ResponseEntity<List<BranchPerformanceDTO>> getBranchPerformance(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getBranchPerformance(storeAdminId));
    }

    @GetMapping("/{storeAdminId}/alerts")
    public ResponseEntity<StoreAlertsDTO> getStoreAlerts(
            @PathVariable Long storeAdminId) throws Exception {
        return ResponseEntity.ok(storeAnalyticsService.getStoreAlerts(storeAdminId));
    }
}
