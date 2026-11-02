package com.zosh.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zosh.domain.OrderStatus;
import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.mapper.ProductMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.*;
import com.zosh.payload.response.*;
import com.zosh.payload.response.AiCopilotDTOs.*;
import com.zosh.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.text.NumberFormat;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiCopilotService {

    private final StoreAnalyticsService storeAnalyticsService;
    private final BranchAnalyticsService branchAnalyticsService;
    private final ShiftReportService shiftReportService;
    private final CouponService couponService;
    private final AccessControlService accessControl;
    private final PlanLimitChecker planLimitChecker;
    private final UserService userService;

    private final StoreRepository storeRepository;
    private final BranchRepository branchRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.ai.gemini-api-key:}")
    private String geminiApiKey;

    @Value("${app.ai.gemini-model:gemini-2.5-flash}")
    private String geminiModel;

    private String formatVnd(Double amount) {
        double safe = amount != null ? amount : 0.0;
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(Math.round(safe)) + " đ";
    }

    /**
     * Kiểm tra bắt buộc gói cước của Store phải đang ACTIVE/TRIAL và có bật cờ AI_COPILOT.
     * Nếu không thỏa mãn -> Chặn cả Chủ Store, Quản lý chi nhánh và Thu ngân.
     */
    private void assertAiFeatureEnabled(Store store) throws Exception {
        User current = userService.getCurrentUser();
        if (current != null && current.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        planLimitChecker.requireActivePlanFeature(store, PlanFeature.AI_COPILOT);
    }

    // =========================================================================
    // ƯU TIÊN 1A: AI INSIGHTS & SMART RESTOCK/COUPON CHO CHỦ CỬA HÀNG (STORE)
    // =========================================================================
    public AiInsightResponse analyzeStore(Long storeAdminId) throws Exception {
        User current = userService.getCurrentUser();
        Store store = accessControl.resolveStoreOfUser(current);
        if (store == null && storeAdminId != null) {
            store = storeRepository.findByStoreAdminId(storeAdminId);
            if (store == null) {
                store = storeRepository.findById(storeAdminId).orElse(null);
            }
        }
        if (store == null) {
            throw new Exception("Store not found for analyzing AI insights");
        }
        accessControl.assertCanAccessStore(current, store);
        assertAiFeatureEnabled(store);

        // Luôn truyền đúng User ID (chủ cửa hàng) cho StoreAnalyticsService
        Long effectiveUserId = (store != null && store.getStoreAdmin() != null)
                ? store.getStoreAdmin().getId()
                : (current != null ? current.getId() : storeAdminId);

        StoreOverviewDTO overview = storeAnalyticsService.getStoreOverview(effectiveUserId);
        List<BranchPerformanceDTO> branches = storeAnalyticsService.getBranchPerformance(effectiveUserId);
        StoreAlertsDTO alerts = storeAnalyticsService.getStoreAlerts(effectiveUserId);

        String storeName = store != null ? store.getBrand() : "Cửa hàng";

        // 1. Phân tích nguyên nhân tăng/giảm doanh thu
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

        // 2. Cảnh báo rủi ro (Chi nhánh yếu, Thu ngân hoàn trả cao bất thường)
        List<String> risks = new ArrayList<>();
        if (alerts.getNoSaleToday() != null && !alerts.getNoSaleToday().isEmpty()) {
            String names = alerts.getNoSaleToday().stream().map(BranchDTO::getName).collect(Collectors.joining(", "));
            risks.add("Có " + alerts.getNoSaleToday().size() + " chi nhánh chưa phát sinh đơn hàng nào hôm nay: " + names + ".");
        }
        if (store != null) {
            List<Refund> storeRefunds = refundRepository.findByBranchStoreId(store.getId());
            Map<String, double[]> cashierRefundStats = new HashMap<>();
            for (Refund r : storeRefunds) {
                String cName = r.getCashier() != null ? r.getCashier().getFullName() : "Không rõ";
                cashierRefundStats.computeIfAbsent(cName, k -> new double[]{0, 0});
                cashierRefundStats.get(cName)[0]++;
                cashierRefundStats.get(cName)[1] += (r.getAmount() != null ? r.getAmount() : 0.0);
            }
            cashierRefundStats.entrySet().stream()
                    .max((a, b) -> Double.compare(a.getValue()[1], b.getValue()[1]))
                    .ifPresent(topRefundCashier -> {
                        if (topRefundCashier.getValue()[0] >= 1) {
                            risks.add("Cảnh báo hoàn trả (Refund): Thu ngân " + topRefundCashier.getKey()
                                    + " có " + (int) topRefundCashier.getValue()[0] + " phiếu hoàn tiền (tổng "
                                    + formatVnd(topRefundCashier.getValue()[1]) + "). Cần kiểm tra lại quy trình tư vấn/thanh toán.");
                        }
                    });
        }
        if (alerts.getInactiveCashiers() != null && !alerts.getInactiveCashiers().isEmpty()) {
            risks.add("Có " + alerts.getInactiveCashiers().size() + " thu ngân không hoạt động trong 7 ngày qua.");
        }
        if (risks.isEmpty()) {
            risks.add("Không phát hiện bất thường về hoàn trả hoặc gian lận thu ngân trong 7 ngày qua.");
        }

        // 3. Dự báo nhập hàng & Gợi ý mã khuyến mãi
        List<RestockSuggestion> restocks = new ArrayList<>();
        List<CouponSuggestion> coupons = new ArrayList<>();
        if (store != null) {
            List<Branch> storeBranches = branchRepository.findByStoreId(store.getId());
            for (Branch b : storeBranches) {
                restocks.addAll(computeRestockForBranch(b.getId(), b.getName()));
                coupons.addAll(computeCouponForBranch(b.getId(), b.getName()));
            }
        }
        restocks.sort(Comparator.comparingInt(RestockSuggestion::getCurrentStock));
        restocks = restocks.stream().limit(6).collect(Collectors.toList());

        Map<String, CouponSuggestion> uniqueCoupons = new LinkedHashMap<>();
        for (CouponSuggestion c : coupons) {
            uniqueCoupons.putIfAbsent(c.getSuggestedCode(), c);
        }
        coupons = uniqueCoupons.values().stream().limit(3).collect(Collectors.toList());

        List<String> actions = new ArrayList<>();
        if (!restocks.isEmpty()) {
            actions.add("Ưu tiên nhập bổ sung ngay " + restocks.size() + " mặt hàng sắp đứt gãy tồn kho nhưng có tốc độ bán cao.");
        }
        if (!coupons.isEmpty()) {
            actions.add("Phát hành mã giảm giá xả hàng cho các sản phẩm tồn kho lớn nhưng bán chậm để thu hồi vốn lưu động.");
        }
        actions.add("Tận dụng tính năng Gợi ý bán chéo (AI Cross-sell) tại quầy thu ngân để nâng giá trị đơn trung bình (AOV).");

        String baseSummary = String.format(
                "Hệ thống %s ghi nhận doanh thu ròng %s (%d đơn hàng). %s",
                storeName,
                formatVnd(overview.getTotalRevenue()),
                overview.getTotalOrders(),
                !restocks.isEmpty() ? ("Phát hiện " + restocks.size() + " mặt hàng cần nhập gấp.") : "Tồn kho các chi nhánh đang ở mức an toàn."
        );

        String aiEnhancedSummary = tryCallGeminiSummary(
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

    // =========================================================================
    // ƯU TIÊN 1B: AI INSIGHTS & SMART RESTOCK CHO QUẢN LÝ CHI NHÁNH (BRANCH)
    // =========================================================================
    public AiInsightResponse analyzeBranch(Long branchId) throws Exception {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new Exception("Branch not found: " + branchId));
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), branch);
        assertAiFeatureEnabled(branch.getStore());

        BranchOverviewDTO today = branchAnalyticsService.getTodayOverview(branchId);
        List<DailySalesDTO> last7Days = branchAnalyticsService.getDailySalesChart(branchId, 7);
        List<TopProductDTO> topProducts = branchAnalyticsService.getTopProductsByQuantity(branchId);
        List<TopCashierDTO> topCashiers = branchAnalyticsService.getTopCashiersByRevenue(branchId);

        double weekRevenue = last7Days.stream().mapToDouble(d -> d.getTotalSales() != null ? d.getTotalSales() : 0.0).sum();
        int weekOrders = last7Days.stream().mapToInt(d -> d.getTotalOrders() != null ? d.getTotalOrders() : 0).sum();

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

        List<String> risks = new ArrayList<>();
        List<Refund> branchRefunds = refundRepository.findByBranchId(branchId);
        Map<String, double[]> refundByCashier = new HashMap<>();
        for (Refund r : branchRefunds) {
            String name = r.getCashier() != null ? r.getCashier().getFullName() : "Không rõ";
            refundByCashier.computeIfAbsent(name, k -> new double[]{0, 0});
            refundByCashier.get(name)[0]++;
            refundByCashier.get(name)[1] += (r.getAmount() != null ? r.getAmount() : 0.0);
        }
        refundByCashier.entrySet().stream()
                .max((a, b) -> Double.compare(a.getValue()[1], b.getValue()[1]))
                .ifPresent(entry -> {
                    if (entry.getValue()[0] > 0) {
                        risks.add("Thu ngân có hoàn trả cao nhất chi nhánh: " + entry.getKey() + " ("
                                + (int) entry.getValue()[0] + " đơn hoàn, tổng " + formatVnd(entry.getValue()[1]) + ").");
                    }
                });

        List<RestockSuggestion> restocks = computeRestockForBranch(branchId, branch.getName());
        List<CouponSuggestion> coupons = computeCouponForBranch(branchId, branch.getName());

        if (today.getLowStockItems() != null && today.getLowStockItems() > 0) {
            risks.add("Chi nhánh hiện có " + today.getLowStockItems() + " mặt hàng chạm hoặc dưới ngưỡng tồn kho tối thiểu.");
        }
        if (risks.isEmpty()) {
            risks.add("Vận hành chi nhánh ổn định, không có cảnh báo tồn kho hay hoàn tiền bất thường.");
        }

        List<String> actions = new ArrayList<>();
        if (!restocks.isEmpty()) {
            actions.add("Bấm nút '+Kho' bên dưới để nhập nhanh cho " + restocks.size() + " sản phẩm sắp hết hàng.");
        }
        if (!coupons.isEmpty()) {
            actions.add("Áp dụng chương trình khuyến mãi xả kho cho mặt hàng tồn đọng nhiều nhưng bán chậm.");
        }
        actions.add("Nhắc thu ngân đẩy mạnh giới thiệu combo bán kèm cho mặt hàng " +
                (!topProducts.isEmpty() ? topProducts.get(0).getProductName() : "bán chạy") + ".");

        String summary = "Chi nhánh " + branch.getName() + " đạt doanh thu 7 ngày " + formatVnd(weekRevenue)
                + ", hôm nay đạt " + formatVnd(today.getTodayRevenue()) + " với AOV " + formatVnd(today.getAvgOrderValue()) + ".";

        String aiText = tryCallGeminiSummary(
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

    private List<RestockSuggestion> computeRestockForBranch(Long branchId, String branchName) {
        List<Inventory> inventories = inventoryRepository.findByBranchId(branchId);
        List<Order> orders = orderRepository.findByBranchIdAndCreatedAtBetween(
                        branchId, java.time.LocalDateTime.now().minusDays(30), java.time.LocalDateTime.now()).stream()
                .filter(o -> o.getStatus() == null || o.getStatus() == OrderStatus.COMPLETED)
                .collect(Collectors.toList());

        Map<Long, Long> soldQtyMap = new HashMap<>();
        for (Order o : orders) {
            if (o.getItems() == null) continue;
            for (OrderItem oi : o.getItems()) {
                if (oi.getProduct() != null && oi.getProduct().getId() != null) {
                    soldQtyMap.merge(oi.getProduct().getId(),
                            oi.getQuantity() != null ? oi.getQuantity().longValue() : 0L,
                            Long::sum);
                }
            }
        }

        List<RestockSuggestion> result = new ArrayList<>();
        for (Inventory inv : inventories) {
            if (inv.getProduct() == null) continue;
            int qty = inv.getQuantity() != null ? inv.getQuantity() : 0;
            int minLevel = inv.getMinStockLevel() != null ? inv.getMinStockLevel() : 10;
            long sold = soldQtyMap.getOrDefault(inv.getProduct().getId(), 0L);

            if (qty <= minLevel || (sold >= 5 && qty <= sold * 1.5)) {
                int targetStock = Math.max(minLevel * 3, (int) Math.max(20, sold * 2));
                int suggestedAdd = Math.max(10, targetStock - qty);
                String urgency = qty == 0 ? "HIGH" : (qty <= minLevel / 2 ? "HIGH" : "MEDIUM");
                String reason = qty <= minLevel
                        ? ("Tồn kho hiện tại (" + qty + ") đã dưới mức tối thiểu (" + minLevel + "), đã bán " + sold + " SP.")
                        : ("Tốc độ bán cao (" + sold + " SP) có nguy cơ hết hàng sớm.");

                result.add(RestockSuggestion.builder()
                        .branchId(branchId)
                        .branchName(branchName)
                        .productId(inv.getProduct().getId())
                        .productName(inv.getProduct().getName())
                        .sku(inv.getProduct().getSku())
                        .currentStock(qty)
                        .minStockLevel(minLevel)
                        .soldQuantity(sold)
                        .suggestedRestockQty(suggestedAdd)
                        .urgency(urgency)
                        .reason(reason)
                        .build());
            }
        }
        result.sort(Comparator.comparingInt(RestockSuggestion::getCurrentStock));
        return result;
    }

    private List<CouponSuggestion> computeCouponForBranch(Long branchId, String branchName) {
        List<Inventory> inventories = inventoryRepository.findByBranchId(branchId);
        List<Order> orders = orderRepository.findByBranchIdAndCreatedAtBetween(
                        branchId, java.time.LocalDateTime.now().minusDays(30), java.time.LocalDateTime.now()).stream()
                .filter(o -> o.getStatus() == null || o.getStatus() == OrderStatus.COMPLETED)
                .collect(Collectors.toList());

        Map<Long, Long> soldQtyMap = new HashMap<>();
        for (Order o : orders) {
            if (o.getItems() == null) continue;
            for (OrderItem oi : o.getItems()) {
                if (oi.getProduct() != null && oi.getProduct().getId() != null) {
                    soldQtyMap.merge(oi.getProduct().getId(),
                            oi.getQuantity() != null ? oi.getQuantity().longValue() : 0L,
                            Long::sum);
                }
            }
        }

        List<CouponSuggestion> suggestions = new ArrayList<>();
        for (Inventory inv : inventories) {
            if (inv.getProduct() == null) continue;
            int qty = inv.getQuantity() != null ? inv.getQuantity() : 0;
            int minLevel = inv.getMinStockLevel() != null ? inv.getMinStockLevel() : 10;
            long sold = soldQtyMap.getOrDefault(inv.getProduct().getId(), 0L);

            if (qty >= Math.max(20, minLevel * 2) && sold <= 2) {
                String cleanSku = inv.getProduct().getSku() != null
                        ? inv.getProduct().getSku().replaceAll("[^A-Za-z0-9]", "").toUpperCase()
                        : "SALE";
                if (cleanSku.length() > 6) cleanSku = cleanSku.substring(0, 6);
                double price = inv.getProduct().getSellingPrice() != null ? inv.getProduct().getSellingPrice() : 50000.0;

                suggestions.add(CouponSuggestion.builder()
                        .suggestedCode("XA" + cleanSku + "15")
                        .discountType("PERCENTAGE")
                        .discountValue(15.0)
                        .minOrderValue((double) Math.round(price * 1.5 / 1000.0) * 1000.0)
                        .targetProductOrCategory(inv.getProduct().getName())
                        .reason("Tồn kho tại " + branchName + " còn " + qty + " SP nhưng mới bán được " + sold
                                + " SP. Nên tạo mã giảm 15% để kích cầu xả hàng.")
                        .build());
            }
        }
        if (suggestions.isEmpty()) {
            suggestions.add(CouponSuggestion.builder()
                    .suggestedCode("COMBO10")
                    .discountType("PERCENTAGE")
                    .discountValue(10.0)
                    .minOrderValue(100000.0)
                    .targetProductOrCategory("Đơn hàng từ 100.000đ")
                    .reason("Gợi ý mã khuyến mãi kích cầu mua thêm (Upsell) cho các đơn hàng từ 100.000đ.")
                    .build());
        }
        return suggestions.stream().limit(3).collect(Collectors.toList());
    }

    // =========================================================================
    // ƯU TIÊN 2A: GỢI Ý BÁN CHÉO (AI CROSS-SELL / UPSELL) TẠI QUẦY POS
    // =========================================================================
    public List<CrossSellSuggestion> getCrossSellSuggestions(
            Long branchId,
            Long storeId,
            Long customerId,
            List<Long> cartProductIds
    ) throws Exception {
        User current = userService.getCurrentUser();
        Store store = accessControl.resolveStoreOfUser(current);
        if (store == null && storeId != null) {
            store = storeRepository.findById(storeId).orElse(null);
        }
        if (branchId != null) {
            Branch branch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new Exception("Branch not found: " + branchId));
            accessControl.assertCanAccessBranch(current, branch);
            if (store == null) {
                store = branch.getStore();
            }
        }
        assertAiFeatureEnabled(store);

        Set<Long> inCart = cartProductIds != null ? new HashSet<>(cartProductIds) : Collections.emptySet();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDateTime thirtyDaysAgo = now.minusDays(30);

        // Chỉ lấy đơn hàng trong 30 ngày gần nhất để tối ưu RAM và tốc độ phản hồi tại quầy POS
        List<Order> branchOrders = branchId != null
                ? orderRepository.findByBranchIdAndCreatedAtBetween(branchId, thirtyDaysAgo, now)
                : (store != null ? orderRepository.findAllByStoreIdWithDetails(store.getId()) : Collections.emptyList());

        Map<Long, Integer> scoreByProductId = new HashMap<>();
        Map<Long, String> reasonByProductId = new HashMap<>();
        Map<Long, Product> productById = new HashMap<>();

        if (customerId != null && store != null) {
            final Long currentStoreId = store.getId();
            Customer cust = customerRepository.findById(customerId).orElse(null);
            // Kiểm tra khách hàng phải thuộc Store hiện tại
            if (cust != null && cust.getStore() != null && cust.getStore().getId().equals(currentStoreId)) {
                List<Order> customerOrders = orderRepository.findByCustomerId(customerId);
                for (Order co : customerOrders) {
                    if (co.getItems() == null) continue;
                    for (OrderItem oi : co.getItems()) {
                        Product p = oi.getProduct();
                        if (p != null && p.getId() != null && !inCart.contains(p.getId())) {
                            productById.put(p.getId(), p);
                            int qty = oi.getQuantity() != null ? oi.getQuantity() : 1;
                            scoreByProductId.merge(p.getId(), qty * 5, Integer::sum);
                            reasonByProductId.putIfAbsent(p.getId(), "Khách hàng này thường xuyên mua trước đây");
                        }
                    }
                }
            }
        }

        for (Order o : branchOrders) {
            if (o.getItems() == null || o.getStatus() == OrderStatus.CANCELLED) continue;
            Set<Long> orderProdIds = o.getItems().stream()
                    .filter(i -> i.getProduct() != null && i.getProduct().getId() != null)
                    .map(i -> i.getProduct().getId())
                    .collect(Collectors.toSet());

            boolean sharesItemWithCart = !inCart.isEmpty() && orderProdIds.stream().anyMatch(inCart::contains);
            for (OrderItem oi : o.getItems()) {
                Product p = oi.getProduct();
                if (p == null || p.getId() == null || inCart.contains(p.getId())) continue;
                productById.putIfAbsent(p.getId(), p);
                int qty = oi.getQuantity() != null ? oi.getQuantity() : 1;
                if (sharesItemWithCart) {
                    scoreByProductId.merge(p.getId(), qty * 10, Integer::sum);
                    reasonByProductId.put(p.getId(), "Hay được mua kèm với sản phẩm đang có trong giỏ");
                } else {
                    scoreByProductId.merge(p.getId(), qty, Integer::sum);
                    reasonByProductId.putIfAbsent(p.getId(), "Sản phẩm bán chạy tại chi nhánh");
                }
            }
        }

        if (scoreByProductId.size() < 3 && store != null) {
            for (Product p : productRepository.findByStoreId(store.getId())) {
                if (!inCart.contains(p.getId()) && !scoreByProductId.containsKey(p.getId())) {
                    productById.put(p.getId(), p);
                    scoreByProductId.put(p.getId(), 1);
                    reasonByProductId.put(p.getId(), "Gợi ý tư vấn thêm cùng danh mục cửa hàng");
                }
            }
        }

        // Loại bỏ sản phẩm hết tồn kho tại chi nhánh hiện tại (nếu gói có hệ thống kho)
        if (branchId != null && planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)) {
            Set<Long> outOfStock = inventoryRepository.findByBranchId(branchId).stream()
                    .filter(inv -> inv.getProduct() != null && (inv.getQuantity() == null || inv.getQuantity() <= 0))
                    .map(inv -> inv.getProduct().getId())
                    .collect(Collectors.toSet());
            scoreByProductId.keySet().removeAll(outOfStock);
        }

        return scoreByProductId.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(3)
                .map(e -> CrossSellSuggestion.builder()
                        .product(ProductMapper.toDTO(productById.get(e.getKey())))
                        .reason(reasonByProductId.getOrDefault(e.getKey(), "Sản phẩm gợi ý mua kèm"))
                        .coOccurrenceScore(e.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    // =========================================================================
    // ƯU TIÊN 2B: LÊN ĐƠN NHANH BẰNG NGÔN NGỮ TỰ NHIÊN / GIỌNG NÓI (QUICK COMMAND)
    // =========================================================================
    public QuickCommandResponse parseQuickOrderCommand(QuickCommandRequest req) throws Exception {
        if (req == null || req.getCommand() == null || req.getCommand().isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập hoặc đọc câu lệnh lên đơn nhanh");
        }
        User current = userService.getCurrentUser();
        Store store = req.getStoreId() != null
                ? storeRepository.findById(req.getStoreId()).orElse(accessControl.resolveStoreOfUser(current))
                : accessControl.resolveStoreOfUser(current);
        if (store == null) {
            throw new IllegalArgumentException("Không xác định được cửa hàng hiện tại");
        }
        assertAiFeatureEnabled(store);

        Long storeId = store.getId();
        String rawText = req.getCommand().trim();
        String workingText = rawText;

        // Chuẩn hóa chữ số tiếng Việt sang số TRƯỚC khi bóc tách khách hàng & sản phẩm
        workingText = workingText
                .replaceAll("(?iU)\\bmột\\b", "1")
                .replaceAll("(?iU)\\bhai\\b", "2")
                .replaceAll("(?iU)\\bba\\b", "3")
                .replaceAll("(?iU)\\bbốn\\b", "4")
                .replaceAll("(?iU)\\bnăm\\b", "5")
                .replaceAll("(?iU)\\bsáu\\b", "6")
                .replaceAll("(?iU)\\bbảy\\b", "7")
                .replaceAll("(?iU)\\btám\\b", "8")
                .replaceAll("(?iU)\\bchín\\b", "9")
                .replaceAll("(?iU)\\bmười\\b", "10");

        // 1. Bóc tách mã giảm giá (VD: "áp mã SALE10", "coupon VIP20")
        CouponDTO matchedCoupon = null;
        String couponError = null;
        Pattern couponPattern = Pattern.compile("(?iU)(?:áp\\s*mã|mã\\s*giảm\\s*giá|coupon|voucher)\\s+([A-Za-z0-9_-]{3,20})");
        Matcher couponMatcher = couponPattern.matcher(workingText);
        if (couponMatcher.find()) {
            String code = couponMatcher.group(1).trim().toUpperCase();
            workingText = workingText.replace(couponMatcher.group(0), " ");
            try {
                matchedCoupon = couponService.getCouponByCode(code, storeId);
            } catch (Exception e) {
                couponError = "Mã '" + code + "': " + e.getMessage();
            }
        }

        // 2. Bóc tách khách hàng theo SĐT hoặc tên
        Customer matchedCustomer = null;
        Pattern phonePattern = Pattern.compile("(0\\d{8,10})");
        Matcher phoneMatcher = phonePattern.matcher(workingText);
        if (phoneMatcher.find()) {
            String phone = phoneMatcher.group(1);
            workingText = workingText.replace(phone, " ");
            List<Customer> found = customerRepository.searchCustomersByStore(storeId, phone);
            if (!found.isEmpty()) {
                matchedCustomer = found.get(0);
            }
        }
        if (matchedCustomer == null) {
            Pattern custNamePattern = Pattern.compile("(?iU)(?:khách\\s+hàng|khách\\s+tên)\\s+([\\p{L}\\s]{2,25}?)(?=,|;|\\.|\\d|áp\\s*mã|thanh\\s*toán|$)");
            Matcher nameMatcher = custNamePattern.matcher(workingText);
            if (nameMatcher.find()) {
                String cName = nameMatcher.group(1).trim();
                workingText = workingText.replace(nameMatcher.group(0), " ");
                List<Customer> found = customerRepository.searchCustomersByStore(storeId, cName);
                if (!found.isEmpty()) {
                    matchedCustomer = found.get(0);
                }
            }
        }

        // 3. Bóc tách phương thức thanh toán
        String paymentMethod = null;
        String lowerRaw = rawText.toLowerCase();
        if (lowerRaw.contains("momo") || lowerRaw.contains("quét mã") || lowerRaw.contains("qr") || lowerRaw.contains("chuyển khoản")) {
            paymentMethod = "UPI";
        } else if (lowerRaw.contains("thẻ") || lowerRaw.contains("visa") || lowerRaw.contains("card") || lowerRaw.contains("quẹt thẻ")) {
            paymentMethod = "CARD";
        } else if (lowerRaw.contains("tiền mặt") || lowerRaw.contains("cash")) {
            paymentMethod = "CASH";
        }

        // 4. Bóc tách danh sách sản phẩm và số lượng
        List<Product> storeProducts = productRepository.findByStoreId(storeId);
        List<QuickCommandItemResult> matchedItems = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();

        workingText = workingText
                .replaceAll("(?iU)\\b(?:cho\\s+khách|sđt|số\\s+điện\\s+thoại)\\b", " ")
                .replaceAll("(?iU)thanh\\s+toán\\s*(?:bằng|qua)?\\s*(?:tiền\\s+mặt|thẻ|visa|card|momo|qr|chuyển\\s+khoản)?", " ");

        Pattern itemPattern = Pattern.compile("(?iU)(?:lấy|mua|thêm|cho|đặt)?\\s*(\\d+)\\s*(?:cái|chiếc|hộp|chai|lon|ly|cốc|gói|bộ|đôi|sp|sản\\s+phẩm|món)?\\s+([^,;+\\n]+)");
        Matcher itemMatcher = itemPattern.matcher(workingText);

        Map<Long, QuickCommandItemResult> mergedByProductId = new LinkedHashMap<>();
        boolean foundPatternMatch = false;

        while (itemMatcher.find()) {
            foundPatternMatch = true;
            int qty = Math.max(1, Integer.parseInt(itemMatcher.group(1)));
            String rawKeyword = itemMatcher.group(2)
                    .replaceAll("(?iU)\\b(cho|khách|áp|mã|sđt)\\b.*$", "")
                    .trim();
            if (rawKeyword.isEmpty()) continue;

            Product bestMatch = findBestMatchingProduct(storeProducts, rawKeyword);
            if (bestMatch != null) {
                mergedByProductId.compute(bestMatch.getId(), (k, existing) -> {
                    if (existing == null) {
                        return QuickCommandItemResult.builder()
                                .product(ProductMapper.toDTO(bestMatch))
                                .quantity(qty)
                                .rawKeyword(rawKeyword)
                                .build();
                    }
                    existing.setQuantity(existing.getQuantity() + qty);
                    return existing;
                });
            } else {
                unmatched.add(rawKeyword);
            }
        }

        if (!foundPatternMatch) {
            for (String segment : workingText.split("[,;+]")) {
                String clean = segment.replaceAll("(?i)^(lấy|mua|thêm)\\s+", "").trim();
                if (clean.length() < 2) continue;
                Product best = findBestMatchingProduct(storeProducts, clean);
                if (best != null) {
                    mergedByProductId.putIfAbsent(best.getId(), QuickCommandItemResult.builder()
                            .product(ProductMapper.toDTO(best))
                            .quantity(1)
                            .rawKeyword(clean)
                            .build());
                } else {
                    unmatched.add(clean);
                }
            }
        }

        matchedItems.addAll(mergedByProductId.values());

        StringBuilder summary = new StringBuilder();
        summary.append("Đã nhận diện ").append(matchedItems.size()).append(" sản phẩm");
        if (matchedCustomer != null) {
            summary.append(", khách hàng: ").append(matchedCustomer.getFullName());
        }
        if (matchedCoupon != null) {
            summary.append(", áp mã: ").append(matchedCoupon.getCode());
        }
        if (couponError != null) {
            summary.append(" (").append(couponError).append(")");
        }

        return QuickCommandResponse.builder()
                .matchedItems(matchedItems)
                .unmatchedKeywords(unmatched)
                .matchedCustomer(matchedCustomer)
                .appliedCoupon(matchedCoupon)
                .couponError(couponError)
                .paymentMethod(paymentMethod)
                .note("AI Quick Order: " + rawText)
                .summaryMessage(summary.toString())
                .build();
    }

    private Product findBestMatchingProduct(List<Product> products, String keyword) {
        if (products == null || keyword == null || keyword.isBlank()) return null;
        String normKey = keyword.toLowerCase().trim();
        Product best = null;
        int bestScore = 0;

        for (Product p : products) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            String sku = p.getSku() != null ? p.getSku().toLowerCase() : "";
            int score = 0;
            if (name.equals(normKey) || sku.equals(normKey)) {
                score = 100;
            } else if (name.contains(normKey) || sku.contains(normKey)) {
                score = 80;
            } else if (normKey.contains(name) && name.length() >= 3) {
                score = 70;
            } else {
                String[] words = normKey.split("\\s+");
                int matchedWords = 0;
                for (String w : words) {
                    if (w.length() >= 2 && (name.contains(w) || sku.contains(w))) {
                        matchedWords++;
                    }
                }
                if (matchedWords > 0) {
                    score = (matchedWords * 50) / words.length;
                }
            }
            if (score > bestScore && score >= 40) {
                bestScore = score;
                best = p;
            }
        }
        return best;
    }

    // =========================================================================
    // ƯU TIÊN 2C: TÓM TẮT BÀN GIAO CA TỰ ĐỘNG (SHIFT SUMMARY AI)
    // =========================================================================
    // NOT_SUPPORTED: không bọc transaction readOnly của class; getCurrentShiftProgress có ghi DB và tự quản lý
    // transaction riêng (lỗi "no active shift" cũng không làm hỏng transaction của hàm này).
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ShiftAiSummaryResponse summarizeShift(Long shiftId) throws Exception {
        User current = userService.getCurrentUser();
        Store store = accessControl.resolveStoreOfUser(current);
        assertAiFeatureEnabled(store);

        ShiftReportDTO shift;
        if (shiftId != null) {
            shift = shiftReportService.getShiftReportById(shiftId);
        } else {
            try {
                shift = shiftReportService.getCurrentShiftProgress(null);
            } catch (Exception e) {
                // Fallback: thu ngân vừa đóng ca -> lấy ca gần nhất của thu ngân đó
                List<ShiftReportDTO> myShifts = shiftReportService.getShiftReportsByCashierId(current.getId());
                if (myShifts == null || myShifts.isEmpty()) {
                    throw new Exception("Chưa có dữ liệu ca làm việc nào để tóm tắt.");
                }
                Long latestShiftId = myShifts.stream()
                        .max(Comparator.comparing(ShiftReportDTO::getShiftStart,
                                Comparator.nullsFirst(Comparator.naturalOrder())))
                        .map(ShiftReportDTO::getId)
                        .orElseThrow(() -> new Exception("Không tìm thấy ca làm việc."));
                shift = shiftReportService.getShiftReportById(latestShiftId);
            }
        }

        String cashierName = shift.getCashier() != null ? shift.getCashier().getFullName() : "Thu ngân";
        String branchName = shift.getBranch() != null ? shift.getBranch().getName() : "Chi nhánh";

        double totalSales = shift.getTotalSales() != null ? shift.getTotalSales() : 0.0;
        double totalRefunds = shift.getTotalRefunds() != null ? shift.getTotalRefunds() : 0.0;
        double netSales = shift.getNetSale() != null ? shift.getNetSale() : (totalSales - totalRefunds);
        int totalOrders = shift.getTotalOrders();

        List<String> paymentHighlights = new ArrayList<>();
        if (shift.getPaymentSummaries() != null && !shift.getPaymentSummaries().isEmpty()) {
            for (PaymentSummary ps : shift.getPaymentSummaries()) {
                paymentHighlights.add(String.format(
                        "%s: %s (%d giao dịch - chiếm %.1f%% tổng thu)",
                        ps.getType(),
                        formatVnd(ps.getTotalAmount()),
                        ps.getTransactionCount(),
                        ps.getPercentage()
                ));
            }
        } else {
            paymentHighlights.add("Chưa phát sinh giao dịch thanh toán trong ca này.");
        }

        List<String> refundAnalysis = new ArrayList<>();
        double cashRefundAmount = 0.0;
        if (shift.getRefunds() != null && !shift.getRefunds().isEmpty()) {
            cashRefundAmount = shift.getRefunds().stream()
                    .filter(r -> r.getPaymentType() == null || "CASH".equalsIgnoreCase(r.getPaymentType().name()))
                    .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                    .sum();
            Map<String, Long> reasonCounts = shift.getRefunds().stream()
                    .collect(Collectors.groupingBy(
                            r -> (r.getReason() != null && !r.getReason().isBlank()) ? r.getReason().trim() : "Không ghi lý do",
                            Collectors.counting()
                    ));
            refundAnalysis.add("Tổng cộng " + shift.getRefunds().size() + " phiếu hoàn trả với số tiền " + formatVnd(totalRefunds) + ".");
            reasonCounts.forEach((reason, count) ->
                    refundAnalysis.add("Lý do '" + reason + "': " + count + " lần.")
            );
        } else {
            refundAnalysis.add("Ca làm việc không phát sinh bất kỳ đơn hoàn trả (Refund) nào.");
        }

        List<String> handoverNotes = new ArrayList<>();
        double cashGross = shift.getPaymentSummaries() == null ? 0.0 : shift.getPaymentSummaries().stream()
                .filter(p -> p.getType() != null && "CASH".equalsIgnoreCase(p.getType().name()))
                .mapToDouble(p -> p.getTotalAmount() != null ? p.getTotalAmount() : 0.0)
                .sum();
        double netCashInDrawer = Math.max(0.0, cashGross - cashRefundAmount);
        handoverNotes.add("Đối chiếu két tiền mặt (CASH) thực tế bàn giao: " + formatVnd(netCashInDrawer)
                + " (Thu tiền mặt: " + formatVnd(cashGross) + " - Hoàn trả tiền mặt: " + formatVnd(cashRefundAmount) + ").");
        if (totalRefunds > 0) {
            handoverNotes.add("Lưu ý kiểm tra chứng từ của " + (shift.getRefunds() != null ? shift.getRefunds().size() : 0)
                    + " giao dịch hoàn trả (" + formatVnd(totalRefunds) + ") khi bàn giao ca.");
        }
        if (shift.getTopSellingProducts() != null && !shift.getTopSellingProducts().isEmpty()) {
            ProductDTO topProd = shift.getTopSellingProducts().get(0);
            handoverNotes.add("Kiểm tra châm thêm hàng lên kệ cho sản phẩm bán chạy nhất ca: "
                    + topProd.getName() + " (đã bán " + topProd.getQuantity() + " SP).");
        }

        String defaultParagraph = String.format(
                "Báo cáo bàn giao ca của %s tại %s: Tổng doanh thu gộp đạt %s trên %d đơn hàng, hoàn trả %s, doanh thu ròng thực thu đạt %s.",
                cashierName, branchName, formatVnd(totalSales), totalOrders, formatVnd(totalRefunds), formatVnd(netSales)
        );

        String aiParagraph = tryCallGeminiSummary(
                "Viết 1 đoạn văn ngắn (3 câu tiếng Việt) tổng kết bàn giao ca làm việc POS cho thu ngân " + cashierName
                        + ": Doanh thu gộp=" + formatVnd(totalSales)
                        + ", Hoàn trả=" + formatVnd(totalRefunds)
                        + ", Doanh thu ròng=" + formatVnd(netSales)
                        + ", Tiền mặt thực có trong két=" + formatVnd(netCashInDrawer)
                        + ", Số đơn=" + totalOrders
                        + ", Tỷ trọng thanh toán=" + paymentHighlights
                        + ", Lý do hoàn trả=" + refundAnalysis
        );

        return ShiftAiSummaryResponse.builder()
                .shiftId(shift.getId())
                .cashierName(cashierName)
                .branchName(branchName)
                .overviewParagraph(aiParagraph != null ? aiParagraph : defaultParagraph)
                .paymentHighlights(paymentHighlights)
                .refundAnalysis(refundAnalysis)
                .handoverNotes(handoverNotes)
                .build();
    }

    private RestTemplate buildAiRestTemplate() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(6000);
        return new RestTemplate(factory);
    }

    private String tryCallGeminiSummary(String prompt) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return null;
        }
        try {
            RestTemplate restTemplate = buildAiRestTemplate();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                    + geminiModel.trim() + ":generateContent?key=" + geminiApiKey.trim();

            Map<String, Object> body = Map.of(
                    "contents", List.of(
                            Map.of("parts", List.of(Map.of("text", prompt)))
                    )
            );
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> res = restTemplate.postForEntity(url, entity, String.class);
            if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                JsonNode root = objectMapper.readTree(res.getBody());
                JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
                if (!textNode.isMissingNode() && !textNode.asText().isBlank()) {
                    return textNode.asText().trim();
                }
            }
        } catch (Exception e) {
            log.debug("Gemini API fallback to built-in engine: {}", e.getMessage());
        }
        return null;
    }
}
