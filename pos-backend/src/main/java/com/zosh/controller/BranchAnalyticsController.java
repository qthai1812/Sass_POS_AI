package com.zosh.controller;

import com.zosh.payload.response.*;
import com.zosh.service.BranchAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/branch-analytics")
public class BranchAnalyticsController {

    private final BranchAnalyticsService branchAnalyticsService;

    @GetMapping("/daily-sales")
    public ResponseEntity<List<DailySalesDTO>> getDailySalesChart(
            @RequestParam Long branchId,
            @RequestParam(defaultValue = "7") int days) {
        return ResponseEntity.ok(branchAnalyticsService.getDailySalesChart(branchId, days));
    }

    @GetMapping("/top-products")
    public ResponseEntity<List<TopProductDTO>> getTopProducts(
            @RequestParam Long branchId) {
        return ResponseEntity.ok(branchAnalyticsService.getTopProductsByQuantity(branchId));
    }

    @GetMapping("/top-cashiers")
    public ResponseEntity<List<TopCashierDTO>> getTopCashiers(
            @RequestParam Long branchId) {
        return ResponseEntity.ok(branchAnalyticsService.getTopCashiersByRevenue(branchId));
    }

    @GetMapping("/category-sales")
    public ResponseEntity<List<CategorySalesDTO>> getCategoryWiseSalesBreakdown(
            @RequestParam Long branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) throws Exception {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(branchAnalyticsService.getCategoryWiseSalesBreakdown(branchId, targetDate));
    }

    @GetMapping("/today-overview")
    public ResponseEntity<BranchOverviewDTO> getTodayOverview(
            @RequestParam Long branchId) {
        return ResponseEntity.ok(branchAnalyticsService.getTodayOverview(branchId));
    }

    @GetMapping("/payment-breakdown")
    public ResponseEntity<List<PaymentBreakdownDTO>> getPaymentBreakdown(
            @RequestParam Long branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(branchAnalyticsService.getPaymentBreakdown(branchId, targetDate));
    }
}
