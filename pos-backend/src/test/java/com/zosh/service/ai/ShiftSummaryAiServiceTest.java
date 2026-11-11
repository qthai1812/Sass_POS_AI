package com.zosh.service.ai;

import com.zosh.domain.PaymentType;
import com.zosh.modal.PaymentSummary;
import com.zosh.payload.dto.*;
import com.zosh.payload.response.AiCopilotDTOs.ShiftAiSummaryResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShiftSummaryAiServiceTest {

    @Mock
    private GeminiClient geminiClient;

    @InjectMocks
    private ShiftSummaryAiService shiftSummaryAiService;

    @Test
    void buildSummary_computesNetCashInDrawerAndRefundReasons() {
        UserDto cashier = new UserDto();
        cashier.setFullName("Lê Thu Ngân");

        PaymentSummary cashPs = new PaymentSummary();
        cashPs.setType(PaymentType.CASH);
        cashPs.setTotalAmount(500000.0);
        cashPs.setTransactionCount(3);
        cashPs.setPercentage(83.3);

        PaymentSummary cardPs = new PaymentSummary();
        cardPs.setType(PaymentType.CARD);
        cardPs.setTotalAmount(100000.0);
        cardPs.setTransactionCount(1);
        cardPs.setPercentage(16.7);

        ShiftReportDTO shift = ShiftReportDTO.builder()
                .id(77L)
                .cashier(cashier)
                .branch(BranchDTO.builder().name("CN Center").build())
                .totalSales(600000.0)
                .totalRefunds(100000.0)
                .netSale(500000.0)
                .totalOrders(4)
                .paymentSummaries(List.of(cashPs, cardPs))
                .refunds(List.of(
                        RefundDTO.builder().amount(100000.0).paymentType(PaymentType.CASH).reason("Đổi size").build()
                ))
                .topSellingProducts(List.of(ProductDTO.builder().name("Váy Hoa").quantity(5).build()))
                .build();

        when(geminiClient.tryGenerateSummary(anyString())).thenReturn(null);

        ShiftAiSummaryResponse res = shiftSummaryAiService.buildSummary(shift);

        assertEquals(77L, res.getShiftId());
        assertEquals("Lê Thu Ngân", res.getCashierName());
        assertEquals(2, res.getPaymentHighlights().size());
        assertTrue(res.getRefundAnalysis().stream().anyMatch(s -> s.contains("Đổi size")));
        // Cash drawer = 500k - 100k = 400.000
        assertTrue(res.getHandoverNotes().get(0).contains("400.000"));
        assertTrue(res.getHandoverNotes().stream().anyMatch(n -> n.contains("Váy Hoa")));
    }

    @Test
    void buildSummary_noRefundsNoPayments_returnsSafeFallbackMessages() {
        ShiftReportDTO shift = ShiftReportDTO.builder()
                .id(88L)
                .totalSales(0.0)
                .totalRefunds(0.0)
                .netSale(0.0)
                .totalOrders(0)
                .build();

        when(geminiClient.tryGenerateSummary(anyString())).thenReturn("Ca làm việc kết thúc suôn sẻ.");

        ShiftAiSummaryResponse res = shiftSummaryAiService.buildSummary(shift);

        assertEquals("Ca làm việc kết thúc suôn sẻ.", res.getOverviewParagraph());
        assertTrue(res.getPaymentHighlights().get(0).contains("Chưa phát sinh"));
        assertTrue(res.getRefundAnalysis().get(0).contains("không phát sinh"));
    }
}
