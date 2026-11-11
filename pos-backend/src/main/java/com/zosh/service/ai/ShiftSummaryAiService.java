package com.zosh.service.ai;

import com.zosh.modal.PaymentSummary;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.response.AiCopilotDTOs.ShiftAiSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static com.zosh.service.ai.AiFormatUtils.formatVnd;

/**
 * Tạo báo cáo tóm tắt bàn giao ca làm việc (Shift Summary AI) gồm tổng quan thanh toán,
 * phân tích hoàn tiền, đối chiếu két tiền mặt và tổng kết từ Gemini (nếu khả dụng).
 */
@Component
@RequiredArgsConstructor
public class ShiftSummaryAiService {

    private final GeminiClient geminiClient;

    public ShiftAiSummaryResponse buildSummary(ShiftReportDTO shift) {
        String cashierName = shift.getCashier() != null ? shift.getCashier().getFullName() : "Thu ngân";
        String branchName = shift.getBranch() != null ? shift.getBranch().getName() : "Chi nhánh";

        double totalSales = shift.getTotalSales() != null ? shift.getTotalSales() : 0.0;
        double totalRefunds = shift.getTotalRefunds() != null ? shift.getTotalRefunds() : 0.0;
        double netSales = shift.getNetSale() != null ? shift.getNetSale() : (totalSales - totalRefunds);
        int totalOrders = shift.getTotalOrders();

        List<String> paymentHighlights = buildPaymentHighlights(shift);
        double cashRefundAmount = calculateCashRefundAmount(shift);
        List<String> refundAnalysis = buildRefundAnalysis(shift, totalRefunds);

        double cashGross = shift.getPaymentSummaries() == null ? 0.0 : shift.getPaymentSummaries().stream()
                .filter(p -> p.getType() != null && "CASH".equalsIgnoreCase(p.getType().name()))
                .mapToDouble(p -> p.getTotalAmount() != null ? p.getTotalAmount() : 0.0)
                .sum();
        double netCashInDrawer = Math.max(0.0, cashGross - cashRefundAmount);

        List<String> handoverNotes = buildHandoverNotes(shift, cashGross, cashRefundAmount, netCashInDrawer, totalRefunds);

        String defaultParagraph = String.format(
                "Báo cáo bàn giao ca của %s tại %s: Tổng doanh thu gộp đạt %s trên %d đơn hàng, hoàn trả %s, doanh thu ròng thực thu đạt %s.",
                cashierName, branchName, formatVnd(totalSales), totalOrders, formatVnd(totalRefunds), formatVnd(netSales)
        );

        String aiParagraph = geminiClient.tryGenerateSummary(
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

    private List<String> buildPaymentHighlights(ShiftReportDTO shift) {
        List<String> highlights = new ArrayList<>();
        if (shift.getPaymentSummaries() != null && !shift.getPaymentSummaries().isEmpty()) {
            for (PaymentSummary ps : shift.getPaymentSummaries()) {
                highlights.add(String.format(
                        "%s: %s (%d giao dịch - chiếm %.1f%% tổng thu)",
                        ps.getType(),
                        formatVnd(ps.getTotalAmount()),
                        ps.getTransactionCount(),
                        ps.getPercentage()
                ));
            }
        } else {
            highlights.add("Chưa phát sinh giao dịch thanh toán trong ca này.");
        }
        return highlights;
    }

    private double calculateCashRefundAmount(ShiftReportDTO shift) {
        if (shift.getRefunds() == null || shift.getRefunds().isEmpty()) {
            return 0.0;
        }
        return shift.getRefunds().stream()
                .filter(r -> r.getPaymentType() == null || "CASH".equalsIgnoreCase(r.getPaymentType().name()))
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();
    }

    private List<String> buildRefundAnalysis(ShiftReportDTO shift, double totalRefunds) {
        List<String> analysis = new ArrayList<>();
        if (shift.getRefunds() != null && !shift.getRefunds().isEmpty()) {
            Map<String, Long> reasonCounts = shift.getRefunds().stream()
                    .collect(Collectors.groupingBy(
                            r -> (r.getReason() != null && !r.getReason().isBlank()) ? r.getReason().trim() : "Không ghi lý do",
                            Collectors.counting()
                    ));
            analysis.add("Tổng cộng " + shift.getRefunds().size() + " phiếu hoàn trả với số tiền " + formatVnd(totalRefunds) + ".");
            reasonCounts.forEach((reason, count) ->
                    analysis.add("Lý do '" + reason + "': " + count + " lần.")
            );
        } else {
            analysis.add("Ca làm việc không phát sinh bất kỳ đơn hoàn trả (Refund) nào.");
        }
        return analysis;
    }

    private List<String> buildHandoverNotes(
            ShiftReportDTO shift,
            double cashGross,
            double cashRefundAmount,
            double netCashInDrawer,
            double totalRefunds
    ) {
        List<String> notes = new ArrayList<>();
        notes.add("Đối chiếu két tiền mặt (CASH) thực tế bàn giao: " + formatVnd(netCashInDrawer)
                + " (Thu tiền mặt: " + formatVnd(cashGross) + " - Hoàn trả tiền mặt: " + formatVnd(cashRefundAmount) + ").");
        if (totalRefunds > 0) {
            notes.add("Lưu ý kiểm tra chứng từ của " + (shift.getRefunds() != null ? shift.getRefunds().size() : 0)
                    + " giao dịch hoàn trả (" + formatVnd(totalRefunds) + ") khi bàn giao ca.");
        }
        if (shift.getTopSellingProducts() != null && !shift.getTopSellingProducts().isEmpty()) {
            ProductDTO topProd = shift.getTopSellingProducts().get(0);
            notes.add("Kiểm tra châm thêm hàng lên kệ cho sản phẩm bán chạy nhất ca: "
                    + topProd.getName() + " (đã bán " + topProd.getQuantity() + " SP).");
        }
        return notes;
    }
}
