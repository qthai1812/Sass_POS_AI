package com.zosh.service.ai;

import com.zosh.modal.Branch;
import com.zosh.modal.Refund;
import com.zosh.modal.Store;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static com.zosh.service.ai.AiFormatUtils.formatVnd;

/**
 * Tổng hợp báo cáo AI Insights cho cấp Cửa hàng (Store) và Chi nhánh (Branch),
 * bao gồm phân tích động lực doanh thu, cảnh báo rủi ro hoàn trả và dự báo nhập/xả hàng.
 */
@Component
@RequiredArgsConstructor
public class StoreBranchInsightService {

    private final StoreAnalyticsService storeAnalyticsService;
    private final BranchAnalyticsService branchAnalyticsService;
    private final BranchRepository branchRepository;
    private final RefundRepository refundRepository;
    private final InventoryForecastingEngine forecastingEngine;
    private final GeminiClient geminiClient;

    public AiInsightResponse buildStoreInsight(Store store, Long effectiveUserId) throws Exception {
        StoreOverviewDTO overview = storeAnalyticsService.getStoreOverview(effectiveUserId);
        List<BranchPerformanceDTO> branches = storeAnalyticsService.getBranchPerformance(effectiveUserId);
        StoreAlertsDTO alerts = storeAnalyticsService.getStoreAlerts(effectiveUserId);

        String storeName = store != null ? store.getBrand() : "Cửa hàng";
        List<String> drivers = buildStoreDrivers(overview, branches);
        List<String> risks = buildStoreRisks(store, alerts);

        List<RestockSuggestion> restocks = new ArrayList<>();
        List<CouponSuggestion> coupons = new ArrayList<>();
        if (store != null) {
            for (Branch b : branchRepository.findByStoreId(store.getId())) {
                BranchForecast forecast = forecastingEngine.forecastForBranch(b.getId(), b.getName());
                restocks.addAll(forecast.restockSuggestions());
                coupons.addAll(forecast.couponSuggestions());
            }
        }
        restocks.sort(Comparator.comparingInt(RestockSuggestion::getCurrentStock));
        restocks = restocks.stream().limit(6).collect(Collectors.toList());

        Map<String, CouponSuggestion> uniqueCoupons = new LinkedHashMap<>();
        for (CouponSuggestion c : coupons) {
            uniqueCoupons.putIfAbsent(c.getSuggestedCode(), c);
        }
        coupons = uniqueCoupons.values().stream().limit(3).collect(Collectors.toList());

        List<String> actions = buildStoreActions(restocks.size(), coupons.size());
        String baseSummary = String.format(
                "Hệ thống %s ghi nhận doanh thu ròng %s (%d đơn hàng). %s",
                storeName,
                formatVnd(overview.getTotalRevenue()),
                overview.getTotalOrders(),
                !restocks.isEmpty() ? ("Phát hiện " + restocks.size() + " mặt hàng cần nhập gấp.") : "Tồn kho các chi nhánh đang ở mức an toàn."
        );

        double growth = overview.getMonthlyGrowthRate() != null ? overview.getMonthlyGrowthRate() : 0.0;
        String aiEnhancedSummary = geminiClient.tryGenerateSummary(
                "Hãy viết 1 đoạn nhận xét ngắn gọn (3-4 câu tiếng Việt chuyên nghiệp) cho Chủ chuỗi cửa hàng " + storeName
                        + " dựa trên số liệu: Doanh thu ròng=" + formatVnd(overview.getTotalRevenue())
                        + ", Tổng đơn=" + overview.getTotalOrders()
                        + ", Tăng trưởng tháng=" + growth + "%"
                        + ", Chi nhánh=" + drivers
                        + ", Cảnh báo=" + risks
        );

        return AiInsightResponse.builder()
                .scope("STORE")
                .targetName(storeName)
                .executiveSummary(aiEnhancedSummary != null ? aiEnhancedSummary : baseSummary)
                .revenueDrivers(drivers)
                .riskAlerts(risks)
                .actionItems(actions)
                .restockSuggestions(restocks)
                .couponSuggestions(coupons)
                .generatedBy(aiEnhancedSummary != null ? "Gemini AI + POS Data" : "POS Smart Analytics Engine")
                .build();
    }

    public AiInsightResponse buildBranchInsight(Branch branch) {
        Long branchId = branch.getId();
        BranchOverviewDTO today = branchAnalyticsService.getTodayOverview(branchId);
        List<DailySalesDTO> last7Days = branchAnalyticsService.getDailySalesChart(branchId, 7);
        List<TopProductDTO> topProducts = branchAnalyticsService.getTopProductsByQuantity(branchId);
        List<TopCashierDTO> topCashiers = branchAnalyticsService.getTopCashiersByRevenue(branchId);

        double weekRevenue = last7Days.stream().mapToDouble(d -> d.getTotalSales() != null ? d.getTotalSales() : 0.0).sum();
        int weekOrders = last7Days.stream().mapToInt(d -> d.getTotalOrders() != null ? d.getTotalOrders() : 0).sum();

        List<String> drivers = buildBranchDrivers(today, weekRevenue, weekOrders, topProducts, topCashiers);
        BranchForecast forecast = forecastingEngine.forecastForBranch(branchId, branch.getName());
        List<RestockSuggestion> restocks = forecast.restockSuggestions();
        // Tạo mã khuyến mãi là nghiệp vụ cấp chuỗi (Store Owner) -> không gợi ý tạo Coupon ở cấp Chi nhánh
        List<CouponSuggestion> coupons = Collections.emptyList();
        List<String> risks = buildBranchRisks(branchId, today);
        List<String> actions = buildBranchActions(restocks.size(), topProducts);

        String summary = "Chi nhánh " + branch.getName() + " đạt doanh thu 7 ngày " + formatVnd(weekRevenue)
                + ", hôm nay đạt " + formatVnd(today.getTodayRevenue()) + " với AOV " + formatVnd(today.getAvgOrderValue()) + ".";

        String aiText = geminiClient.tryGenerateSummary(
                "Viết nhận xét ngắn 3 câu tiếng Việt cho Quản lý chi nhánh " + branch.getName()
                        + ": Doanh thu hôm nay=" + formatVnd(today.getTodayRevenue())
                        + ", Doanh thu 7 ngày=" + formatVnd(weekRevenue)
                        + ", Mặt hàng sắp hết=" + restocks.size()
                        + ", Cảnh báo=" + risks
        );

        return AiInsightResponse.builder()
                .scope("BRANCH")
                .targetName(branch.getName())
                .executiveSummary(aiText != null ? aiText : summary)
                .revenueDrivers(drivers)
                .riskAlerts(risks)
                .actionItems(actions)
                .restockSuggestions(restocks)
                .couponSuggestions(coupons)
                .generatedBy(aiText != null ? "Gemini AI + POS Data" : "POS Smart Analytics Engine")
                .build();
    }

    private List<String> buildStoreDrivers(StoreOverviewDTO overview, List<BranchPerformanceDTO> branches) {
        List<String> drivers = new ArrayList<>();
        double growth = overview.getMonthlyGrowthRate() != null ? overview.getMonthlyGrowthRate() : 0.0;
        if (growth > 0) {
            drivers.add("Doanh thu tháng này tăng trưởng +" + growth + "% so với tháng trước, tổng doanh thu ròng đạt "
                    + formatVnd(overview.getTotalRevenue()) + " trên " + overview.getTotalOrders() + " đơn hàng.");
        } else if (growth < 0) {
            drivers.add("Doanh thu tháng này giảm " + growth + "% so với tháng trước. Giá trị đơn trung bình (AOV) hiện ở mức "
                    + formatVnd(overview.getAvgOrderValue()) + ".");
        } else {
            drivers.add("Tổng doanh thu ròng đạt " + formatVnd(overview.getTotalRevenue())
                    + " với giá trị đơn hàng trung bình " + formatVnd(overview.getAvgOrderValue()) + ".");
        }

        if (!branches.isEmpty()) {
            BranchPerformanceDTO topBranch = branches.get(0);
            drivers.add("Chi nhánh dẫn đầu doanh thu: " + topBranch.getBranchName() + " ("
                    + formatVnd(topBranch.getTotalRevenue()) + " - " + topBranch.getTotalOrders() + " đơn).");
            if (branches.size() > 1) {
                BranchPerformanceDTO weakest = branches.get(branches.size() - 1);
                drivers.add("Chi nhánh cần cải thiện: " + weakest.getBranchName() + " (doanh thu "
                        + formatVnd(weakest.getTotalRevenue()) + ", AOV " + formatVnd(weakest.getAvgOrderValue()) + ").");
            }
        }
        return drivers;
    }

    private List<String> buildStoreRisks(Store store, StoreAlertsDTO alerts) {
        List<String> risks = new ArrayList<>();
        if (alerts.getNoSaleToday() != null && !alerts.getNoSaleToday().isEmpty()) {
            String names = alerts.getNoSaleToday().stream().map(BranchDTO::getName).collect(Collectors.joining(", "));
            risks.add("Có " + alerts.getNoSaleToday().size() + " chi nhánh chưa phát sinh đơn hàng nào hôm nay: " + names + ".");
        }
        if (store != null) {
            findTopRefundCashier(refundRepository.findByBranchStoreId(store.getId()))
                    .ifPresent(top -> risks.add(
                            "Cảnh báo hoàn trả (Refund 7 ngày qua): Thu ngân " + top.getKey()
                                    + " có " + (int) top.getValue()[0] + " phiếu hoàn tiền (tổng "
                                    + formatVnd(top.getValue()[1]) + "). Cần kiểm tra lại quy trình tư vấn/thanh toán."
                    ));
        }
        if (alerts.getInactiveCashiers() != null && !alerts.getInactiveCashiers().isEmpty()) {
            risks.add("Có " + alerts.getInactiveCashiers().size() + " thu ngân không hoạt động trong 7 ngày qua.");
        }
        if (risks.isEmpty()) {
            risks.add("Không phát hiện bất thường về hoàn trả hoặc gian lận thu ngân trong 7 ngày qua.");
        }
        return risks;
    }

    private List<String> buildBranchDrivers(
            BranchOverviewDTO today,
            double weekRevenue,
            int weekOrders,
            List<TopProductDTO> topProducts,
            List<TopCashierDTO> topCashiers
    ) {
        List<String> drivers = new ArrayList<>();
        drivers.add("Doanh thu hôm nay đạt " + formatVnd(today.getTodayRevenue()) + " (" + today.getTodayOrders()
                + " đơn), lũy kế 7 ngày gần nhất đạt " + formatVnd(weekRevenue) + " (" + weekOrders + " đơn).");
        if (!topProducts.isEmpty()) {
            TopProductDTO best = topProducts.get(0);
            drivers.add("Sản phẩm chủ lực: " + best.getProductName() + " (đã bán " + best.getTotalQuantity()
                    + " sản phẩm, đóng góp " + best.getPercentageContribution() + "% sản lượng).");
        }
        if (!topCashiers.isEmpty()) {
            TopCashierDTO bestCashier = topCashiers.get(0);
            drivers.add("Thu ngân hiệu suất cao nhất: " + bestCashier.getCashierName() + " ("
                    + formatVnd(bestCashier.getTotalRevenue()) + " qua " + bestCashier.getTotalOrders() + " đơn).");
        }
        return drivers;
    }

    private List<String> buildBranchRisks(Long branchId, BranchOverviewDTO today) {
        List<String> risks = new ArrayList<>();
        findTopRefundCashier(refundRepository.findByBranchId(branchId))
                .ifPresent(entry -> risks.add(
                        "Thu ngân có hoàn trả cao nhất chi nhánh (7 ngày qua): " + entry.getKey() + " ("
                                + (int) entry.getValue()[0] + " đơn hoàn, tổng " + formatVnd(entry.getValue()[1]) + ")."
                ));
        if (today.getLowStockItems() != null && today.getLowStockItems() > 0) {
            risks.add("Chi nhánh hiện có " + today.getLowStockItems() + " mặt hàng chạm hoặc dưới ngưỡng tồn kho tối thiểu.");
        }
        if (risks.isEmpty()) {
            risks.add("Vận hành chi nhánh ổn định, không có cảnh báo tồn kho hay hoàn tiền bất thường.");
        }
        return risks;
    }

    private Optional<Map.Entry<String, double[]>> findTopRefundCashier(List<Refund> refunds) {
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        Map<String, double[]> stats = new HashMap<>();
        for (Refund r : refunds) {
            if (r.getCreatedAt() != null && r.getCreatedAt().isBefore(sevenDaysAgo)) {
                continue;
            }
            String name = r.getCashier() != null ? r.getCashier().getFullName() : "Không rõ";
            stats.computeIfAbsent(name, k -> new double[]{0, 0});
            stats.get(name)[0]++;
            stats.get(name)[1] += (r.getAmount() != null ? r.getAmount() : 0.0);
        }
        return stats.entrySet().stream()
                .filter(e -> e.getValue()[0] >= 1)
                .max(Comparator.comparingDouble(e -> e.getValue()[1]));
    }

    private List<String> buildStoreActions(int restockCount, int couponCount) {
        List<String> actions = new ArrayList<>();
        if (restockCount > 0) {
            actions.add("Ưu tiên nhập bổ sung ngay " + restockCount + " mặt hàng sắp đứt gãy tồn kho nhưng có tốc độ bán cao.");
        }
        if (couponCount > 0) {
            actions.add("Phát hành mã giảm giá xả hàng cho các sản phẩm tồn kho lớn nhưng bán chậm để thu hồi vốn lưu động.");
        }
        actions.add("Tận dụng tính năng Gợi ý bán chéo (AI Cross-sell) tại quầy thu ngân để nâng giá trị đơn trung bình (AOV).");
        return actions;
    }

    private List<String> buildBranchActions(int restockCount, List<TopProductDTO> topProducts) {
        List<String> actions = new ArrayList<>();
        if (restockCount > 0) {
            actions.add("Bấm nút '+Kho' bên dưới để nhập nhanh cho " + restockCount + " sản phẩm sắp hết hàng.");
        }
        actions.add("Nhắc thu ngân đẩy mạnh giới thiệu combo bán kèm cho mặt hàng " +
                (!topProducts.isEmpty() ? topProducts.get(0).getProductName() : "bán chạy") + ".");
        return actions;
    }
}
