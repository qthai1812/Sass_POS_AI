package com.zosh.payload.response;

import com.zosh.modal.Customer;
import com.zosh.payload.dto.CouponDTO;
import com.zosh.payload.dto.ProductDTO;
import lombok.*;

import java.util.List;

public class AiCopilotDTOs {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiInsightResponse {
        private String scope; // STORE or BRANCH
        private String targetName;
        private String executiveSummary;
        private List<String> revenueDrivers;
        private List<String> riskAlerts;
        private List<String> actionItems;
        private List<RestockSuggestion> restockSuggestions;
        private List<CouponSuggestion> couponSuggestions;
        private String generatedBy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RestockSuggestion {
        private Long branchId;
        private String branchName;
        private Long productId;
        private String productName;
        private String sku;
        private Integer currentStock;
        private Integer minStockLevel;
        private Long soldQuantity;
        private Integer suggestedRestockQty;
        private String urgency; // HIGH, MEDIUM, LOW
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CouponSuggestion {
        private String suggestedCode;
        private String discountType; // PERCENTAGE or FLAT
        private Double discountValue;
        private Double minOrderValue;
        private String targetProductOrCategory;
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CrossSellSuggestion {
        private ProductDTO product;
        private String reason;
        private int coOccurrenceScore;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuickCommandRequest {
        private Long storeId;
        private Long branchId;
        private String command;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuickCommandItemResult {
        private ProductDTO product;
        private int quantity;
        private String rawKeyword;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuickCommandResponse {
        private List<QuickCommandItemResult> matchedItems;
        private List<String> unmatchedKeywords;
        private Customer matchedCustomer;
        private CouponDTO appliedCoupon;
        private String couponError;
        private String paymentMethod; // CASH, CARD, UPI
        private String note;
        private String summaryMessage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShiftAiSummaryResponse {
        private Long shiftId;
        private String cashierName;
        private String branchName;
        private String overviewParagraph;
        private List<String> paymentHighlights;
        private List<String> refundAnalysis;
        private List<String> handoverNotes;
    }
}
