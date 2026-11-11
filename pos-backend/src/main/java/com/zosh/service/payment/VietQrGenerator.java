package com.zosh.service.payment;

import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Sinh mã giao dịch, mã đối soát VietQR (`POSxxxxxx`), chữ ký webhook và URL ảnh QR EMVCo.
 */
@Component
public class VietQrGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public String generateSessionId() {
        return "PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    public String generateReferenceCode() {
        return String.format("POS%06d", SECURE_RANDOM.nextInt(1_000_000));
    }

    public String generateWebhookToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public String buildVietQrImageUrl(String bankBin, String accountForVietQr, long amountVnd,
                                      String refCode, String storeName, String recipientName) {
        String encodedAddInfo = URLEncoder.encode(refCode + " Thanh toan " + storeName, StandardCharsets.UTF_8);
        String encodedAccountName = URLEncoder.encode(recipientName, StandardCharsets.UTF_8);
        return String.format(
                "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                bankBin, accountForVietQr, amountVnd, encodedAddInfo, encodedAccountName
        );
    }

    public String buildMobileCheckoutUrl(String backendBaseUrl, String sessionId) {
        return String.format("%s/api/payment-gateway/checkout/%s", backendBaseUrl, sessionId);
    }

    public String buildQrServerImageUrl(String targetUrl) {
        return "https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data="
                + URLEncoder.encode(targetUrl, StandardCharsets.UTF_8);
    }

    public String resolveBankBin(String bankName) {
        if (bankName == null) {
            return "970422";
        }
        String lower = bankName.toLowerCase();
        if (lower.contains("vietcombank") || lower.contains("vcb")) return "970436";
        if (lower.contains("techcombank") || lower.contains("tcb")) return "970407";
        if (lower.contains("bidv")) return "970418";
        if (lower.contains("vietin") || lower.contains("ctg")) return "970415";
        if (lower.contains("acb")) return "970416";
        if (lower.contains("vpbank") || lower.contains("vpb")) return "970432";
        if (lower.contains("tpbank") || lower.contains("tpb")) return "970423";
        if (lower.contains("sacombank") || lower.contains("stb")) return "970403";
        if (lower.contains("agribank")) return "970405";
        if (lower.contains("hdbank")) return "970437";
        if (lower.contains("vib")) return "970441";
        if (lower.contains("shb")) return "970443";
        return "970422";
    }
}
