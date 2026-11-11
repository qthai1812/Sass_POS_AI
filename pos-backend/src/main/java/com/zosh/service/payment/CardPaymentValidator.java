package com.zosh.service.payment;

import com.zosh.service.PaymentGatewayService.CardAuthorizeRequest;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Xác thực định dạng thẻ và mô phỏng cổng thanh toán 3D-Secure (chỉ dùng cho môi trường dev/local).
 */
@Component
public class CardPaymentValidator {

    public boolean processAuthorization(PaymentSessionDTO session, CardAuthorizeRequest req) {
        String rawCard = req.getCardNumber() != null ? req.getCardNumber().replaceAll("\\D", "") : "";
        String expiry = req.getExpiry() != null ? req.getExpiry().trim() : "";
        String cvv = req.getCvv() != null ? req.getCvv().replaceAll("\\D", "") : "";
        String holder = req.getCardHolder() != null ? req.getCardHolder().trim() : "";

        session.setUpdatedAt(LocalDateTime.now());

        if (rawCard.length() < 12 || rawCard.length() > 19) {
            return fail(session, "Cổng thẻ từ chối: Số thẻ không hợp lệ (cần từ 12–19 chữ số).");
        }
        if (!isValidExpiry(expiry)) {
            return fail(session, "Cổng thẻ từ chối: Thẻ đã hết hạn hoặc sai định dạng MM/YY.");
        }
        if (cvv.length() < 3 || cvv.length() > 4) {
            return fail(session, "Cổng thẻ từ chối: Mã bảo mật CVV/CVC không hợp lệ.");
        }
        if (holder.length() < 2) {
            return fail(session, "Cổng thẻ từ chối: Vui lòng nhập họ tên chủ thẻ.");
        }
        if ("000".equals(cvv)) {
            return fail(session, "Ngân hàng phát hành từ chối giao dịch (Mã lỗi: DO_NOT_HONOR / Insufficient Funds).");
        }

        String brand = detectCardBrand(rawCard);
        String last4 = rawCard.substring(rawCard.length() - 4);
        String txId = brand.toUpperCase() + "-3DS-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();

        session.setCardBrand(brand);
        session.setMaskedCardNumber("•••• •••• •••• " + last4);
        session.setTransactionId(txId);
        session.setStatus("SUCCESS");
        session.setPaidAt(LocalDateTime.now());
        session.setProviderMessage("Cổng " + brand + " 3D-Secure xác nhận trừ tiền thành công (Mã chuẩn chi: " + txId + ")");
        return true;
    }

    public boolean isValidExpiry(String expiry) {
        if (expiry == null || !expiry.matches("^(0[1-9]|1[0-2])/\\d{2}$")) {
            return false;
        }
        try {
            String[] parts = expiry.split("/");
            int month = Integer.parseInt(parts[0]);
            int year = 2000 + Integer.parseInt(parts[1]);
            YearMonth cardYm = YearMonth.of(year, month);
            return !cardYm.isBefore(YearMonth.now());
        } catch (Exception e) {
            return false;
        }
    }

    public String detectCardBrand(String number) {
        if (number.startsWith("4")) return "Visa";
        if (number.matches("^5[1-5].*") || number.matches("^2(2[2-9]|[3-6]\\d|7[01]|720).*")) return "Mastercard";
        if (number.startsWith("35")) return "JCB";
        if (number.startsWith("9704")) return "Napas";
        return "Visa/Debit";
    }

    private boolean fail(PaymentSessionDTO session, String message) {
        session.setStatus("FAILED");
        session.setProviderMessage(message);
        return false;
    }
}
