package com.zosh.controller;

import com.zosh.modal.PlatformPaymentConfig;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PaymentGatewayService.CardAuthorizeRequest;
import com.zosh.service.PaymentGatewayService.CreateSessionRequest;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PaymentGatewayService.SepayWebhookPayload;
import com.zosh.service.PaymentGatewayService.WebhookRequest;
import com.zosh.service.payment.CheckoutPageRenderer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payment-gateway")
@RequiredArgsConstructor
public class PaymentGatewayController {

    private final PaymentGatewayService paymentGatewayService;
    private final CheckoutPageRenderer checkoutPageRenderer;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/platform-config")
    public ResponseEntity<PlatformPaymentConfig> getPlatformPaymentConfig() {
        return ResponseEntity.ok(paymentGatewayService.getPublicPlatformConfig());
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/platform-config")
    public ResponseEntity<PlatformPaymentConfig> updatePlatformPaymentConfig(
            @RequestBody PlatformPaymentConfig payload
    ) {
        return ResponseEntity.ok(paymentGatewayService.updatePlatformConfig(payload));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'CASHIER')")
    @PostMapping("/sessions")
    public ResponseEntity<PaymentSessionDTO> createSession(@RequestBody CreateSessionRequest req) {
        return ResponseEntity.ok(paymentGatewayService.createSession(req));
    }

    @PreAuthorize("hasRole('CASHIER')")
    @PutMapping("/sessions/{sessionId}/link-order")
    public ResponseEntity<PaymentSessionDTO> linkOrderToSession(
            @PathVariable String sessionId,
            @RequestParam Long orderId
    ) {
        PaymentSessionDTO updated = paymentGatewayService.linkOrderToSession(sessionId, orderId);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PutMapping("/sessions/{sessionId}/link-subscription")
    public ResponseEntity<PaymentSessionDTO> linkSubscriptionToSession(
            @PathVariable String sessionId,
            @RequestParam Long subscriptionId
    ) {
        PaymentSessionDTO updated = paymentGatewayService.linkSubscriptionToSession(sessionId, subscriptionId);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'CASHIER')")
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<PaymentSessionDTO> getSession(@PathVariable String sessionId) {
        PaymentSessionDTO session = paymentGatewayService.getSessionForViewer(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(session);
    }

    @PostMapping("/webhook/{sessionId}")
    public ResponseEntity<PaymentSessionDTO> receiveWebhook(
            @PathVariable String sessionId,
            @RequestHeader(value = "X-Webhook-Signature", required = false) String signatureHeader,
            @RequestBody(required = false) WebhookRequest req
    ) {
        PaymentSessionDTO updated = paymentGatewayService.processWebhook(sessionId, signatureHeader, req);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/webhook/sepay")
    public ResponseEntity<?> receiveSepayWebhook(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody SepayWebhookPayload payload
    ) {
        PaymentSessionDTO session = paymentGatewayService.processSepayWebhook(authorizationHeader, payload);
        if (session != null) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Xác nhận giao dịch thành công",
                    "sessionId", session.getSessionId(),
                    "status", session.getStatus()
            ));
        }
        // Luôn trả về 200 cho SePay để tránh SePay retry lại nhiều lần khi giao dịch không liên quan
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Đã nhận webhook, không có phiên thanh toán nào khớp hoặc giao dịch không phải tiền vào"
        ));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'CASHIER')")
    @PostMapping("/sessions/{sessionId}/authorize-card")
    public ResponseEntity<PaymentSessionDTO> authorizeCard(
            @PathVariable String sessionId,
            @RequestBody CardAuthorizeRequest req
    ) {
        PaymentSessionDTO result = paymentGatewayService.authorizeCard(sessionId, req);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        if ("FAILED".equals(result.getStatus())) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping(value = "/checkout/{sessionId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> renderMobileCheckoutPage(@PathVariable String sessionId) {
        PaymentSessionDTO s = paymentGatewayService.getRawSession(sessionId);
        if (s == null) {
            return ResponseEntity.status(404).body(checkoutPageRenderer.renderNotFoundHtml());
        }
        return ResponseEntity.ok(checkoutPageRenderer.renderMobileCheckoutHtml(s));
    }
}
