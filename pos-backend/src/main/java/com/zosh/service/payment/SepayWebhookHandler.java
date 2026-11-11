package com.zosh.service.payment;

import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PaymentGatewayService.SepayWebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.regex.Pattern;

/**
 * Xử lý Webhook IPN thật từ SePay: xác thực API Key (fail-closed), chống trùng giao dịch,
 * đối soát mã thanh toán (referenceCode) và kiểm tra số tiền chuyển vào.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SepayWebhookHandler {

    private final PaymentSessionStore sessionStore;
    private final PaymentFulfillmentCoordinator fulfillmentCoordinator;

    @Value("${sepay.api-key:}")
    private String sepayApiKey;

    void setSepayApiKeyForTest(String sepayApiKey) {
        this.sepayApiKey = sepayApiKey;
    }

    public PaymentSessionDTO handle(String authorizationHeader, SepayWebhookPayload payload) {
        if (payload == null) {
            return null;
        }

        assertValidApiKey(authorizationHeader);

        // Chỉ xử lý các giao dịch nhận tiền (transferType = "in")
        if (payload.getTransferType() != null && !"in".equalsIgnoreCase(payload.getTransferType().trim())) {
            return null;
        }

        String providerTxId = buildProviderTxId(payload);
        if (providerTxId != null && sessionStore.existsByProviderTxId(providerTxId)) {
            log.info("Idempotent SePay webhook: providerTxId {} already processed", providerTxId);
            return null;
        }

        String transferContent = upper(payload.getContent());
        String sepayCode = upper(payload.getCode());
        String sepayDesc = upper(payload.getDescription());
        String incomingAccount = payload.getAccountNumber() != null
                ? payload.getAccountNumber().replaceAll("\\s+", "") : "";
        double transferAmount = payload.getTransferAmount() != null ? payload.getTransferAmount() : 0.0;
        LocalDateTime cutoff = LocalDateTime.now().minusHours(PaymentSessionStore.SESSION_TTL_HOURS);

        PaymentSessionDTO matchedSession = sessionStore.findPendingSessionForSepay(
                ref -> matchesSepayReference(ref, sepayCode, transferContent, sepayDesc),
                incomingAccount,
                cutoff
        );

        if (matchedSession == null || matchedSession.isConsumed()
                || !"PENDING".equalsIgnoreCase(matchedSession.getStatus())) {
            return null;
        }

        if (transferAmount + 1.0 < matchedSession.getAmount()) {
            matchedSession.setProviderMessage("SePay: Khách chuyển thiếu tiền ("
                    + String.format("%,.0f", transferAmount) + "₫ / "
                    + String.format("%,.0f", matchedSession.getAmount()) + "₫)");
            sessionStore.syncSessionToDb(matchedSession);
            return matchedSession;
        }

        String txId = providerTxId != null ? providerTxId : ("SEPAY-" + System.currentTimeMillis());
        matchedSession.setStatus("SUCCESS");
        matchedSession.setTransactionId(txId);
        matchedSession.setProviderTxId(providerTxId != null ? providerTxId : txId);
        matchedSession.setPaidAt(LocalDateTime.now());
        matchedSession.setUpdatedAt(LocalDateTime.now());
        String gw = payload.getGateway() != null ? payload.getGateway() : "Ngân hàng/MoMo";
        matchedSession.setProviderMessage("SePay xác nhận: Đã nhận đủ "
                + String.format("%,.0f", transferAmount) + "₫ qua " + gw + " (Mã GD: " + txId + ")");

        fulfillmentCoordinator.fulfillOnSuccess(matchedSession);
        sessionStore.syncSessionToDb(matchedSession);
        return matchedSession;
    }

    private void assertValidApiKey(String authorizationHeader) {
        if (sepayApiKey == null || sepayApiKey.isBlank()
                || sepayApiKey.equalsIgnoreCase("your_sepay_api_key_secret_here")) {
            throw new AccessDeniedException("SePay Webhook chưa được cấu hình API Key bảo mật (SEPAY_API_KEY).");
        }
        String token = authorizationHeader != null
                ? authorizationHeader.replaceFirst("(?i)^apikey\\s+", "").trim()
                : "";
        boolean validApiKey = !token.isEmpty() && MessageDigest.isEqual(
                sepayApiKey.trim().getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8)
        );
        if (!validApiKey) {
            throw new AccessDeniedException("Sai SePay API Key (Unauthorized webhook).");
        }
    }

    private String buildProviderTxId(SepayWebhookPayload payload) {
        if (payload.getId() != null) {
            return "SEPAY-" + payload.getId();
        }
        if (payload.getReferenceCode() != null && !payload.getReferenceCode().isBlank()) {
            return "SEPAY-REF-" + payload.getReferenceCode().trim();
        }
        return null;
    }

    public boolean matchesSepayReference(String referenceCode, String sepayCode,
                                         String transferContent, String sepayDesc) {
        String ref = referenceCode != null ? referenceCode.trim().toUpperCase() : "";
        if (ref.isBlank()) {
            return false;
        }
        String boundaryRegex = "(?i).*(?<![A-Z0-9])" + Pattern.quote(ref) + "(?![A-Z0-9]).*";
        return (!sepayCode.isBlank() && sepayCode.matches(boundaryRegex))
                || (!transferContent.isBlank() && transferContent.matches(boundaryRegex))
                || (!sepayDesc.isBlank() && sepayDesc.matches(boundaryRegex));
    }

    private String upper(String s) {
        return s != null ? s.toUpperCase() : "";
    }
}
