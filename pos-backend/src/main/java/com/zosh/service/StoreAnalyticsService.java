package com.zosh.service;

import com.zosh.payload.response.*;

import java.util.List;

public interface StoreAnalyticsService {
    StoreOverviewDTO getStoreOverview(Long storeAdminId) throws Exception;
    List<SalesTrendDTO> getSalesTrends(Long storeAdminId, String period) throws Exception;
    List<DailySalesDTO> getDailySales(Long storeAdminId) throws Exception;
    List<DailySalesDTO> getMonthlySales(Long storeAdminId) throws Exception;
    List<CategorySalesDTO> getSalesByCategory(Long storeAdminId) throws Exception;
    List<PaymentBreakdownDTO> getSalesByPaymentMethod(Long storeAdminId) throws Exception;
    List<BranchPerformanceDTO> getSalesByBranch(Long storeAdminId) throws Exception;
    List<PaymentBreakdownDTO> getPaymentBreakdown(Long storeAdminId) throws Exception;
    List<BranchPerformanceDTO> getBranchPerformance(Long storeAdminId) throws Exception;
    StoreAlertsDTO getStoreAlerts(Long storeAdminId) throws Exception;
}
