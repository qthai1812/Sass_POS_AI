package com.zosh.controller;

import com.zosh.modal.PlatformPaymentConfig;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PaymentGatewayService.CardAuthorizeRequest;
import com.zosh.service.PaymentGatewayService.CreateSessionRequest;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PaymentGatewayService.WebhookRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.HtmlUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/payment-gateway")
@RequiredArgsConstructor
public class PaymentGatewayController {

    private final PaymentGatewayService paymentGatewayService;

    @GetMapping("/platform-config")
    public ResponseEntity<PlatformPaymentConfig> getPlatformPaymentConfig() {
        return ResponseEntity.ok(paymentGatewayService.getOrCreatePlatformConfig());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/platform-config")
    public ResponseEntity<PlatformPaymentConfig> updatePlatformPaymentConfig(
            @RequestBody PlatformPaymentConfig payload
    ) {
        return ResponseEntity.ok(paymentGatewayService.updatePlatformConfig(payload));
    }

    @PostMapping("/sessions")
    public ResponseEntity<PaymentSessionDTO> createSession(@RequestBody CreateSessionRequest req) {
        return ResponseEntity.ok(paymentGatewayService.createSession(req));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<PaymentSessionDTO> getSession(@PathVariable String sessionId) {
        PaymentSessionDTO session = paymentGatewayService.getRawSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(paymentGatewayService.sanitizePublicView(session));
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
            return ResponseEntity.status(404).body("<html><body style='font-family:sans-serif;text-align:center;padding:40px;'><h2>Không tìm thấy phiên thanh toán</h2></body></html>");
        }

        String formattedAmount = String.format("%,.0f ₫", s.getAmount());
        boolean alreadyPaid = "SUCCESS".equals(s.getStatus());
        String safeStoreName = HtmlUtils.htmlEscape(s.getStoreName() != null ? s.getStoreName() : "");
        String safeRecipientName = HtmlUtils.htmlEscape(s.getRecipientName() != null ? s.getRecipientName() : "");
        String safeRecipientPhone = HtmlUtils.htmlEscape(s.getRecipientPhone() != null ? s.getRecipientPhone() : "");
        String safeReferenceCode = HtmlUtils.htmlEscape(s.getReferenceCode() != null ? s.getReferenceCode() : "");
        String safeSessionId = URLEncoder.encode(sessionId, StandardCharsets.UTF_8);
        String safeWebhookToken = HtmlUtils.htmlEscape(s.getWebhookToken() != null ? s.getWebhookToken() : "");

        String html = "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'/>"
                + "<meta name='viewport' content='width=device-width, initial-scale=1.0'/>"
                + "<title>Cổng Thanh Toán MoMo / VietQR - " + safeStoreName + "</title>"
                + "<style>"
                + "body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#a50064 0%,#d82d8b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;color:#1e293b;}"
                + ".card{background:#fff;width:100%;max-width:400px;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.3);text-align:center;}"
                + ".badge{display:inline-block;background:#fce7f3;color:#a50064;font-weight:700;font-size:12px;padding:6px 14px;border-radius:999px;margin-bottom:12px;}"
                + ".amount{font-size:32px;font-weight:900;color:#a50064;margin:8px 0 16px;}"
                + ".row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;}"
                + ".label{color:#64748b;}"
                + ".val{font-weight:700;color:#0f172a;}"
                + ".btn{width:100%;border:none;border-radius:14px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;margin-top:16px;transition:0.2s;}"
                + ".btn-pay{background:#a50064;color:#fff;box-shadow:0 8px 20px rgba(165,0,100,0.35);}"
                + ".btn-cancel{background:#f1f5f9;color:#475569;margin-top:10px;}"
                + ".ok-box{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:16px;border-radius:16px;margin-top:16px;font-weight:600;}"
                + "</style></head><body>"
                + "<div class='card'>"
                + "<div class='badge'>CỔNG XÁC THỰC MOMO / VIETQR</div>"
                + "<h2 style='margin:0;font-size:20px;'>" + safeStoreName + "</h2>"
                + "<div class='amount'>" + formattedAmount + "</div>"
                + "<div class='row'><span class='label'>Người nhận</span><span class='val'>" + safeRecipientName + "</span></div>"
                + "<div class='row'><span class='label'>Số ĐT / TK</span><span class='val'>" + safeRecipientPhone + "</span></div>"
                + "<div class='row'><span class='label'>Mã tham chiếu</span><span class='val'>" + safeReferenceCode + "</span></div>"
                + "<div id='action-area'>"
                + (alreadyPaid
                ? "<div class='ok-box'>✅ Giao dịch đã được xác nhận thành công!<br/><small>Màn hình thu ngân POS đã tự động hoàn tất đơn hàng.</small></div>"
                : "<button class='btn btn-pay' onclick='sendWebhook(\"SUCCESS\")'>Xác nhận Thanh toán " + formattedAmount + "</button>"
                  + "<button class='btn btn-cancel' onclick='sendWebhook(\"FAILED\")'>Hủy giao dịch</button>")
                + "</div>"
                + "</div>"
                + "<script>"
                + "const WEBHOOK_SIG = '" + safeWebhookToken + "';"
                + "async function sendWebhook(status){"
                + "  const area = document.getElementById('action-area');"
                + "  area.innerHTML = '<p style=\"color:#a50064;font-weight:600;\">Đang gửi thông báo IPN Webhook về máy POS...</p>';"
                + "  try {"
                + "    const res = await fetch('/api/payment-gateway/webhook/" + safeSessionId + "', {"
                + "      method:'POST', headers:{'Content-Type':'application/json', 'X-Webhook-Signature': WEBHOOK_SIG},"
                + "      body: JSON.stringify({status: status, providerName: 'MoMo Mobile App'})"
                + "    });"
                + "    if(res.ok && status==='SUCCESS'){"
                + "      area.innerHTML = '<div class=\"ok-box\">✅ Thanh toán thành công!<br/><small>Đã gửi thông báo IPN về máy thu ngân POS.</small></div>';"
                + "    } else {"
                + "      area.innerHTML = '<div style=\"background:#fef2f2;color:#b91c1c;padding:14px;border-radius:12px;margin-top:14px;font-weight:600;\">Đã hủy giao dịch thanh toán.</div>';"
                + "    }"
                + "  } catch(e){ area.innerHTML = '<p style=\"color:red;\">Lỗi kết nối mạng!</p>'; }"
                + "}"
                + "</script></body></html>";

        return ResponseEntity.ok(html);
    }
}
