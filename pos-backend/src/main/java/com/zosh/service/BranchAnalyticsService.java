package com.zosh.service;

import com.zosh.payload.response.*;

import java.time.LocalDate;
import java.util.List;

public interface BranchAnalyticsService {
    List<DailySalesDTO> getDailySalesChart(Long branchId, int days);
    List<TopProductDTO> getTopProductsByQuantity(Long branchId);
    List<TopCashierDTO> getTopCashiersByRevenue(Long branchId);
    List<CategorySalesDTO> getCategoryWiseSalesBreakdown(Long branchId, LocalDate date) throws Exception;
    BranchOverviewDTO getTodayOverview(Long branchId);
    List<PaymentBreakdownDTO> getPaymentBreakdown(Long branchId, LocalDate date);
}
