package com.zosh.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.zosh.modal.PlatformPaymentConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

public interface PaymentGatewayService {

    boolean isSimulationAllowed();

    PaymentSessionDTO sanitizePublicView(PaymentSessionDTO session);

    PaymentSessionDTO linkOrderToSession(String sessionId, Long orderId);

    PaymentSessionDTO linkSubscriptionToSession(String sessionId, Long subscriptionId);

    PlatformPaymentConfig getPublicPlatformConfig();

    PlatformPaymentConfig getOrCreatePlatformConfig();

    PlatformPaymentConfig updatePlatformConfig(PlatformPaymentConfig payload);

    PaymentSessionDTO createSession(CreateSessionRequest req);

    PaymentSessionDTO getSessionForViewer(String sessionId);

    PaymentSessionDTO getRawSession(String sessionId);

    boolean verifyWebhookSignature(PaymentSessionDTO session, String providedSignature);

    PaymentSessionDTO processWebhook(String sessionId, String signatureHeader, WebhookRequest req);

    PaymentSessionDTO processSepayWebhook(String authorizationHeader, SepayWebhookPayload payload);

    PaymentSessionDTO authorizeCard(String sessionId, CardAuthorizeRequest req);

    PaymentSessionDTO verifyAndConsumeSubscriptionPayment(String transactionId, double requiredAmount);

    PaymentSessionDTO verifyAndConsumePosOrderPayment(
            String txOrSessionId,
            Long branchStoreId,
            double requiredAmount,
            Long targetOrderId
    );

    PaymentSessionDTO verifyAndConsumePosOrderPayment(
            String txOrSessionId,
            Long branchStoreId,
            double requiredAmount
    );

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    class PaymentSessionDTO {
        private String sessionId;
        private Long storeId;
        private String storeName;
        private String planId;
        private Long createdByUserId;
        private Long orderId;
        private Long subscriptionId;
        private Double amount;
        private String method; // MOMO, CARD
        private String status; // PENDING, PROCESSING, SUCCESS, FAILED
        private String referenceCode;
        private String transactionId;
        private String providerTxId;
        private String providerName;
        private String providerMessage;
        private String recipientPhone;
        private String recipientName;
        private String bankBin;
        private String bankName;
        private String bankAccount;
        private String vietQrImageUrl;
        private String mobileCheckoutUrl;
        private String qrImageForMobileCheckout;
        private String maskedCardNumber;
        private String cardBrand;
        private String webhookToken;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private LocalDateTime paidAt;

        @JsonIgnore
        private boolean consumed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class CreateSessionRequest {
        private Long storeId;
        private String storeName;
        private String planId;
        private Long orderId;
        private Long subscriptionId;
        private Double amount;
        private String method; // MOMO or CARD
        private String description;
        private String recipientPhone;
        private String recipientName;
        private String bankName;
        private String bankAccount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class WebhookRequest {
        private String status; // SUCCESS or FAILED
        private String providerName;
        private String transactionId;
        private String message;
        private String signature;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    class CardAuthorizeRequest {
        private String cardNumber;
        private String expiry; // MM/YY
        private String cvv;
        private String cardHolder;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    class SepayWebhookPayload {
        private Long id;                  // ID giao dịch trên SePay (VD: 92704)
        private String gateway;           // Cổng/Ngân hàng (MBBank, Vietcombank, MoMo...)
        private String transactionDate;   // Thời gian giao dịch (VD: 2026-11-04 10:25:00)
        private String accountNumber;     // Số tài khoản nhận tiền
        private String code;              // Mã thanh toán do SePay tự nhận diện từ nội dung
        private String content;           // Toàn bộ nội dung chuyển khoản
        private String transferType;      // Loại giao dịch: "in" (tiền vào) hoặc "out" (tiền ra)
        private Double transferAmount;    // Số tiền chuyển vào
        private Double accumulated;       // Số dư lũy kế sau giao dịch
        private String subAccount;
        private String referenceCode;     // Mã tham chiếu ngân hàng
        private String description;
    }
}
