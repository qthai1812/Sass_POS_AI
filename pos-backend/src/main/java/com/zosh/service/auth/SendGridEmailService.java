package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;

/**
 * Gửi email qua SendGrid Web API v3 (HTTPS cổng 443) và render template email OTP.
 */
@Slf4j
@Component
public class SendGridEmailService {

    static final String SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${app.mail.from:no-reply@pospro.com}")
    private String mailFrom;

    @Value("${app.mail.from-name:POS Pro Security}")
    private String mailFromName;

    private final RestTemplate restTemplate;

    @Autowired
    public SendGridEmailService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    SendGridEmailService(RestTemplate restTemplate, String mailPassword, String mailFrom, String mailFromName) {
        this.restTemplate = restTemplate;
        this.mailPassword = mailPassword;
        this.mailFrom = mailFrom;
        this.mailFromName = mailFromName;
    }

    public boolean isConfigured() {
        return mailPassword != null && !mailPassword.isBlank()
                && !"abcd".equals(mailPassword.trim())
                && mailFrom != null && !mailFrom.isBlank();
    }

    public void assertConfigured() throws UserException {
        if (!isConfigured()) {
            throw new UserException("Lỗi cấu hình Sender: Thiếu MAIL_PASSWORD (SendGrid API Key) hoặc MAIL_FROM.");
        }
    }

    public void sendOtpEmail(String toEmail, String recipientFullName, String otpCode) throws UserException {
        String subject = "[POS Pro] Mã xác thực OTP khôi phục mật khẩu: " + otpCode;
        String htmlContent = buildOtpEmailHtml(recipientFullName, otpCode);
        sendEmailViaSendGridApi(toEmail, subject, htmlContent);
        log.info("Đã gửi thành công email OTP khôi phục mật khẩu qua SendGrid Web API tới {}", toEmail);
    }

    public String buildOtpEmailHtml(String recipientFullName, String otpCode) {
        String safeName = HtmlUtils.htmlEscape(recipientFullName != null ? recipientFullName : "Quý khách");
        return """
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #111827; margin-top: 0;">Yêu cầu khôi phục mật khẩu</h2>
                    <p style="color: #374151; font-size: 14px;">Xin chào <strong>%s</strong>,</p>
                    <p style="color: #374151; font-size: 14px;">Mã xác thực OTP gồm 6 chữ số để đặt lại mật khẩu tài khoản POS Pro của bạn là:</p>
                    <div style="background: #f3f4f6; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #059669;">%s</span>
                    </div>
                    <p style="color: #dc2626; font-size: 13px;"><strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong> và chỉ sử dụng 1 lần duy nhất.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                </div>
                """.formatted(safeName, otpCode);
    }

    public void sendEmailViaSendGridApi(String toEmail, String subject, String htmlContent) throws UserException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(mailPassword.trim());

        Map<String, Object> payload = Map.of(
                "personalizations", List.of(
                        Map.of(
                                "to", List.of(Map.of("email", toEmail.trim())),
                                "subject", subject
                        )
                ),
                "from", Map.of(
                        "email", mailFrom.trim(),
                        "name", mailFromName != null ? mailFromName.trim() : "POS Pro Security"
                ),
                "content", List.of(
                        Map.of(
                                "type", "text/html",
                                "value", htmlContent
                        )
                )
        );

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(payload, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(SENDGRID_API_URL, requestEntity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new UserException("SendGrid Web API trả về mã lỗi: " + response.getStatusCode());
            }
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            log.error("SendGrid Web API HTTP error {} while sending OTP to {}: {}", status, toEmail, body);
            if (status == 401) {
                throw new UserException("Lỗi xác thực SendGrid API (401): Sai API Key (MAIL_PASSWORD) hoặc Key đã bị khóa. Chi tiết: " + body);
            }
            if (status == 403) {
                throw new UserException("Lỗi từ chối từ SendGrid API (403): Địa chỉ MAIL_FROM (" + mailFrom
                        + ") chưa được xác thực (Single Sender Verification) trên SendGrid hoặc API Key chưa bật quyền Mail Send. Chi tiết: " + body);
            }
            throw new UserException("Lỗi từ SendGrid Web API (" + status + "): " + body);
        } catch (UserException ue) {
            throw ue;
        } catch (Exception e) {
            log.error("Unexpected error calling SendGrid Web API for {}: {}", toEmail, e.getMessage(), e);
            throw new UserException("Không thể kết nối tới SendGrid Web API: " + e.getMessage());
        }
    }
}
