package com.zosh.service.payment;

import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * Render trang HTML thông tin chuyển khoản VietQR / MoMo dành cho khách hàng quét mã trên điện thoại.
 */
@Component
public class CheckoutPageRenderer {

    public String renderNotFoundHtml() {
        return "<html><body style='font-family:sans-serif;text-align:center;padding:40px;'>"
                + "<h2>Không tìm thấy phiên thanh toán</h2></body></html>";
    }

    public String renderMobileCheckoutHtml(PaymentSessionDTO s) {
        String formattedAmount = String.format("%,.0f ₫", s.getAmount());
        boolean alreadyPaid = "SUCCESS".equals(s.getStatus());
        boolean isFailed = "FAILED".equals(s.getStatus());
        String safeStoreName = HtmlUtils.htmlEscape(s.getStoreName() != null ? s.getStoreName() : "");
        String safeRecipientName = HtmlUtils.htmlEscape(s.getRecipientName() != null ? s.getRecipientName() : "");
        String safeRecipientPhone = HtmlUtils.htmlEscape(s.getRecipientPhone() != null ? s.getRecipientPhone() : "");
        String safeBankName = HtmlUtils.htmlEscape(s.getBankName() != null ? s.getBankName() : "");
        String safeReferenceCode = HtmlUtils.htmlEscape(s.getReferenceCode() != null ? s.getReferenceCode() : "");
        String safeVietQrUrl = HtmlUtils.htmlEscape(s.getVietQrImageUrl() != null ? s.getVietQrImageUrl() : "");

        String qrBlock = (!safeVietQrUrl.isEmpty() && !alreadyPaid)
                ? "<div style='margin:10px 0;'><img src='" + safeVietQrUrl
                + "' alt='VietQR' style='width:220px;height:220px;object-fit:contain;border-radius:12px;border:1px solid #e2e8f0;'/></div>"
                : "";

        String statusBox;
        if (alreadyPaid) {
            statusBox = "<div class='ok-box'>✅ Giao dịch đã được xác nhận thành công!<br/><small>Màn hình thu ngân POS đã tự động hoàn tất đơn hàng.</small></div>";
        } else if (isFailed) {
            statusBox = "<div class='err-box'>Giao dịch đã bị hủy hoặc từ chối.</div>";
        } else {
            statusBox = "<div class='wait-box'>⏳ Vui lòng chuyển khoản đúng số tiền và nội dung <b>"
                    + safeReferenceCode + "</b>.<br/><small>Hệ thống sẽ tự động xác nhận ngay khi nhận được thông báo từ ngân hàng.</small></div>";
        }

        return "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'/>"
                + "<meta name='viewport' content='width=device-width, initial-scale=1.0'/>"
                + (!alreadyPaid && !isFailed ? "<meta http-equiv='refresh' content='5'/>" : "")
                + "<title>Thông Tin Chuyển Khoản VietQR - " + safeStoreName + "</title>"
                + "<style>"
                + "body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#a50064 0%,#d82d8b 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;color:#1e293b;}"
                + ".card{background:#fff;width:100%;max-width:400px;border-radius:24px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.3);text-align:center;}"
                + ".badge{display:inline-block;background:#fce7f3;color:#a50064;font-weight:700;font-size:12px;padding:6px 14px;border-radius:999px;margin-bottom:12px;}"
                + ".amount{font-size:32px;font-weight:900;color:#a50064;margin:8px 0 16px;}"
                + ".row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;}"
                + ".label{color:#64748b;}"
                + ".val{font-weight:700;color:#0f172a;}"
                + ".ok-box{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:16px;border-radius:16px;margin-top:16px;font-weight:600;}"
                + ".wait-box{background:#fdf2f8;border:1px solid #fbcfe8;color:#9d174d;padding:14px;border-radius:16px;margin-top:16px;font-size:13px;font-weight:600;}"
                + ".err-box{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:14px;border-radius:16px;margin-top:16px;font-size:13px;font-weight:600;}"
                + "</style></head><body>"
                + "<div class='card'>"
                + "<div class='badge'>THÔNG TIN THANH TOÁN VIETQR / MOMO</div>"
                + "<h2 style='margin:0;font-size:20px;'>" + safeStoreName + "</h2>"
                + "<div class='amount'>" + formattedAmount + "</div>"
                + qrBlock
                + "<div class='row'><span class='label'>Ngân hàng</span><span class='val'>" + safeBankName + "</span></div>"
                + "<div class='row'><span class='label'>Người nhận</span><span class='val'>" + safeRecipientName + "</span></div>"
                + "<div class='row'><span class='label'>Số ĐT / TK</span><span class='val'>" + safeRecipientPhone + "</span></div>"
                + "<div class='row'><span class='label'>Nội dung CK</span><span class='val'>" + safeReferenceCode + "</span></div>"
                + "<div id='action-area'>" + statusBox + "</div>"
                + "</div>"
                + "</body></html>";
    }
}
