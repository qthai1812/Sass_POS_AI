package com.zosh.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.zosh.modal.PlatformPaymentConfig;
import com.zosh.modal.Store;
import com.zosh.modal.StorePaymentInfo;
import com.zosh.repository.PlatformPaymentConfigRepository;
import com.zosh.repository.StoreRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class PaymentGatewayService {

    private final StoreRepository storeRepository;
    private final PlatformPaymentConfigRepository platformPaymentConfigRepository;

    @Value("${server.port:5000}")
    private int serverPort;

    private static final int MAX_CACHED_SESSIONS = 2000;
    private static final long SESSION_TTL_HOURS = 2L;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final Map<String, PaymentSessionDTO> sessions = new ConcurrentHashMap<>();

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PaymentSessionDTO {
        private String sessionId;
        private Long storeId;
        private String storeName;
        private Double amount;
        private String method; // MOMO, CARD
        private String status; // PENDING, PROCESSING, SUCCESS, FAILED
        private String referenceCode;
        private String transactionId;
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
    public static class CreateSessionRequest {
        private Long storeId;
        private String storeName;
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
    public static class WebhookRequest {
        private String status; // SUCCESS or FAILED
        private String providerName;
        private String transactionId;
        private String message;
        private String signature;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardAuthorizeRequest {
        private String cardNumber;
        private String expiry; // MM/YY
        private String cvv;
        private String cardHolder;
    }

    private String generateWebhookToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /** Trả về bản sao DTO đã ẩn webhookToken trên các endpoint công khai (polling / webhook response). */
    public PaymentSessionDTO sanitizePublicView(PaymentSessionDTO session) {
        if (session == null) {
            return null;
        }
        return session.toBuilder().webhookToken(null).build();
    }

    private void evictExpiredSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(SESSION_TTL_HOURS);
        sessions.entrySet().removeIf(entry -> {
            PaymentSessionDTO s = entry.getValue();
            return s == null || s.getCreatedAt() == null || s.getCreatedAt().isBefore(cutoff);
        });
        int excess = sessions.size() - MAX_CACHED_SESSIONS;
        if (excess > 0) {
            // Ưu tiên xóa các phiên đã hoàn tất/tiêu thụ hoặc thất bại cũ nhất trước, không bao giờ xóa nhầm phiên mới tạo
            Comparator<Map.Entry<String, PaymentSessionDTO>> evictionOrder = Comparator
                    .<Map.Entry<String, PaymentSessionDTO>, Integer>comparing(entry -> {
                        PaymentSessionDTO s = entry.getValue();
                        if (s == null || s.isConsumed() || "FAILED".equals(s.getStatus())) {
                            return 0;
                        }
                        if ("SUCCESS".equals(s.getStatus())) {
                            return 1;
                        }
                        return 2; // PENDING sessions evicted last
                    })
                    .thenComparing(
                            entry -> entry.getValue() != null ? entry.getValue().getCreatedAt() : null,
                            Comparator.nullsFirst(Comparator.naturalOrder())
                    );

            List<String> keysToRemove = sessions.entrySet().stream()
                    .sorted(evictionOrder)
                    .limit(excess)
                    .map(Map.Entry::getKey)
                    .toList();
            keysToRemove.forEach(sessions::remove);
        }
    }

    public PlatformPaymentConfig getOrCreatePlatformConfig() {
        return platformPaymentConfigRepository.findAll().stream().findFirst().orElseGet(() -> {
            PlatformPaymentConfig def = PlatformPaymentConfig.builder()
                    .acceptMomo(true)
                    .acceptCard(true)
                    .momoPhone("0901234567")
                    .momoOwnerName("POS PRO ENTERPRISE SAAS")
                    .momoQrImage("")
                    .cardBankName("Vietcombank - Visa")
                    .cardNumber("4221567890123456")
                    .cardHolderName("POS PRO ENTERPRISE SAAS")
                    .cardExpiry("12/29")
                    .updatedAt(LocalDateTime.now())
                    .build();
            return platformPaymentConfigRepository.save(def);
        });
    }

    public PlatformPaymentConfig updatePlatformConfig(PlatformPaymentConfig payload) {
        PlatformPaymentConfig cfg = getOrCreatePlatformConfig();
        if (payload.getAcceptMomo() != null) cfg.setAcceptMomo(payload.getAcceptMomo());
        if (payload.getAcceptCard() != null) cfg.setAcceptCard(payload.getAcceptCard());
        if (payload.getMomoPhone() != null) cfg.setMomoPhone(payload.getMomoPhone().trim());
        if (payload.getMomoOwnerName() != null) cfg.setMomoOwnerName(payload.getMomoOwnerName().trim());
        if (payload.getMomoQrImage() != null) cfg.setMomoQrImage(payload.getMomoQrImage().trim());
        if (payload.getCardBankName() != null) cfg.setCardBankName(payload.getCardBankName().trim());
        if (payload.getCardNumber() != null) cfg.setCardNumber(payload.getCardNumber().trim());
        if (payload.getCardHolderName() != null) cfg.setCardHolderName(payload.getCardHolderName().trim());
        if (payload.getCardExpiry() != null) cfg.setCardExpiry(payload.getCardExpiry().trim());
        cfg.setUpdatedAt(LocalDateTime.now());
        return platformPaymentConfigRepository.save(cfg);
    }

    public PaymentSessionDTO createSession(CreateSessionRequest req) {
        String sessionId = "PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String refCode = "POS" + (System.currentTimeMillis() % 1000000);
        String webhookToken = generateWebhookToken();

        String storeName = req.getStoreName() != null && !req.getStoreName().isBlank()
                ? req.getStoreName() : "POS Pro Store";
        String momoPhone = req.getRecipientPhone();
        String momoName = req.getRecipientName();
        String bankName = req.getBankName();
        String bankAccount = req.getBankAccount();

        if (req.getStoreId() != null) {
            Store store = storeRepository.findById(req.getStoreId()).orElse(null);
            if (store != null) {
                if (store.getBrand() != null) {
                    storeName = store.getBrand();
                }
                StorePaymentInfo info = store.getPaymentInfo();
                if (info != null) {
                    if ((momoPhone == null || momoPhone.isBlank()) && info.getMomoPhone() != null) {
                        momoPhone = info.getMomoPhone();
                    }
                    if ((momoName == null || momoName.isBlank()) && info.getMomoOwnerName() != null) {
                        momoName = info.getMomoOwnerName();
                    }
                    if ((bankName == null || bankName.isBlank()) && info.getCardBankName() != null) {
                        bankName = info.getCardBankName();
                    }
                    if ((bankAccount == null || bankAccount.isBlank()) && info.getCardNumber() != null) {
                        bankAccount = info.getCardNumber();
                    }
                    if ((momoName == null || momoName.isBlank()) && info.getCardHolderName() != null) {
                        momoName = info.getCardHolderName();
                    }
                }
            }
        } else {
            PlatformPaymentConfig platformCfg = getOrCreatePlatformConfig();
            if ((momoPhone == null || momoPhone.isBlank()) && platformCfg.getMomoPhone() != null) {
                momoPhone = platformCfg.getMomoPhone();
            }
            if ((momoName == null || momoName.isBlank()) && platformCfg.getMomoOwnerName() != null) {
                momoName = platformCfg.getMomoOwnerName();
            }
            if ((bankName == null || bankName.isBlank()) && platformCfg.getCardBankName() != null) {
                bankName = platformCfg.getCardBankName();
            }
            if ((bankAccount == null || bankAccount.isBlank()) && platformCfg.getCardNumber() != null) {
                bankAccount = platformCfg.getCardNumber();
            }
            if ((momoName == null || momoName.isBlank()) && platformCfg.getCardHolderName() != null) {
                momoName = platformCfg.getCardHolderName();
            }
        }

        if (momoPhone == null || momoPhone.isBlank()) {
            momoPhone = "0901234567";
        }
        if (momoName == null || momoName.isBlank()) {
            momoName = storeName.toUpperCase();
        }
        if (bankName == null || bankName.isBlank()) {
            bankName = "MB Bank";
        }

        String accountForVietQr = (bankAccount != null && !bankAccount.isBlank())
                ? bankAccount.replaceAll("\\s+", "")
                : momoPhone.replaceAll("\\s+", "");
        String bankBin = resolveBankBin(bankName);
        long amountVnd = req.getAmount() != null ? Math.max(1000L, Math.round(req.getAmount())) : 10000L;

        String encodedAddInfo = URLEncoder.encode(refCode + " Thanh toan " + storeName, StandardCharsets.UTF_8);
        String encodedAccountName = URLEncoder.encode(momoName, StandardCharsets.UTF_8);

        String vietQrImageUrl = String.format(
                "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=%s&accountName=%s",
                bankBin, accountForVietQr, amountVnd, encodedAddInfo, encodedAccountName
        );

        String lanIp = detectLanIp();
        String mobileCheckoutUrl = String.format("http://%s:%d/api/payment-gateway/checkout/%s", lanIp, serverPort, sessionId);
        String qrImageForMobileCheckout = "https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data="
                + URLEncoder.encode(mobileCheckoutUrl, StandardCharsets.UTF_8);

        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId(sessionId)
                .storeId(req.getStoreId())
                .storeName(storeName)
                .amount((double) amountVnd)
                .method(req.getMethod() != null ? req.getMethod().toUpperCase() : "MOMO")
                .status("PENDING")
                .referenceCode(refCode)
                .providerName("MOMO".equalsIgnoreCase(req.getMethod()) ? "MoMo / Napas247 VietQR" : "Visa / Mastercard 3DS Gateway")
                .providerMessage("Đang chờ thông báo xác nhận giao dịch từ bên thứ 3...")
                .recipientPhone(momoPhone)
                .recipientName(momoName)
                .bankBin(bankBin)
                .bankName(bankName)
                .bankAccount(accountForVietQr)
                .vietQrImageUrl(vietQrImageUrl)
                .mobileCheckoutUrl(mobileCheckoutUrl)
                .qrImageForMobileCheckout(qrImageForMobileCheckout)
                .webhookToken(webhookToken)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .consumed(false)
                .build();

        evictExpiredSessions();
        sessions.put(sessionId, session);
        // Chỉ trả về webhookToken duy nhất tại thời điểm khởi tạo session đã xác thực JWT
        return session;
    }

    public PaymentSessionDTO getRawSession(String sessionId) {
        return sessionId != null ? sessions.get(sessionId) : null;
    }

    public boolean verifyWebhookSignature(PaymentSessionDTO session, String providedSignature) {
        if (session == null || session.getWebhookToken() == null || providedSignature == null || providedSignature.isBlank()) {
            return false;
        }
        byte[] expected = session.getWebhookToken().getBytes(StandardCharsets.UTF_8);
        byte[] actual = providedSignature.trim().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    public synchronized PaymentSessionDTO processWebhook(
            String sessionId,
            String signatureHeader,
            WebhookRequest req
    ) {
        PaymentSessionDTO session = sessions.get(sessionId);
        if (session == null) {
            return null;
        }

        String candidateSig = (signatureHeader != null && !signatureHeader.isBlank())
                ? signatureHeader
                : (req != null ? req.getSignature() : null);

        if (!verifyWebhookSignature(session, candidateSig)) {
            throw new AccessDeniedException("Invalid or missing webhook signature (X-Webhook-Signature)");
        }

        if (session.isConsumed()) {
            return sanitizePublicView(session);
        }

        String status = (req != null && req.getStatus() != null) ? req.getStatus().toUpperCase() : "SUCCESS";
        if (!"SUCCESS".equals(status) && !"FAILED".equals(status)) {
            throw new IllegalArgumentException("Invalid webhook payment status: " + status);
        }

        String txId = ("SUCCESS".equals(status) && session.getTransactionId() != null && !session.getTransactionId().isBlank())
                ? session.getTransactionId()
                : ("MOMO-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());

        session.setStatus(status);
        session.setTransactionId(txId);
        session.setUpdatedAt(LocalDateTime.now());

        if ("SUCCESS".equals(status)) {
            session.setPaidAt(LocalDateTime.now());
            session.setProviderMessage(
                    req != null && req.getMessage() != null
                            ? req.getMessage()
                            : "Webhook IPN: Đã nhận đủ " + String.format("%,.0f", session.getAmount()) + "₫ (Mã GD: " + txId + ")"
            );
        } else {
            session.setProviderMessage(
                    req != null && req.getMessage() != null
                            ? req.getMessage()
                            : "Giao dịch bị từ chối hoặc khách hàng đã hủy thanh toán."
            );
        }

        return sanitizePublicView(session);
    }

    public synchronized PaymentSessionDTO authorizeCard(String sessionId, CardAuthorizeRequest req) {
        PaymentSessionDTO session = sessions.get(sessionId);
        if (session == null) {
            return null;
        }
        if (session.isConsumed()) {
            throw new IllegalStateException("This payment session has already been completed and consumed");
        }

        String rawCard = req.getCardNumber() != null ? req.getCardNumber().replaceAll("\\D", "") : "";
        String expiry = req.getExpiry() != null ? req.getExpiry().trim() : "";
        String cvv = req.getCvv() != null ? req.getCvv().replaceAll("\\D", "") : "";
        String holder = req.getCardHolder() != null ? req.getCardHolder().trim() : "";

        session.setUpdatedAt(LocalDateTime.now());

        if (rawCard.length() < 12 || rawCard.length() > 19) {
            session.setStatus("FAILED");
            session.setProviderMessage("Cổng thẻ từ chối: Số thẻ không hợp lệ (cần từ 12–19 chữ số).");
            return sanitizePublicView(session);
        }

        if (!isValidExpiry(expiry)) {
            session.setStatus("FAILED");
            session.setProviderMessage("Cổng thẻ từ chối: Thẻ đã hết hạn hoặc sai định dạng MM/YY.");
            return sanitizePublicView(session);
        }

        if (cvv.length() < 3 || cvv.length() > 4) {
            session.setStatus("FAILED");
            session.setProviderMessage("Cổng thẻ từ chối: Mã bảo mật CVV/CVC không hợp lệ.");
            return sanitizePublicView(session);
        }

        if (holder.length() < 2) {
            session.setStatus("FAILED");
            session.setProviderMessage("Cổng thẻ từ chối: Vui lòng nhập họ tên chủ thẻ.");
            return sanitizePublicView(session);
        }

        if ("000".equals(cvv)) {
            session.setStatus("FAILED");
            session.setProviderMessage("Ngân hàng phát hành từ chối giao dịch (Mã lỗi: DO_NOT_HONOR / Insufficient Funds).");
            return sanitizePublicView(session);
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

        return sanitizePublicView(session);
    }

    /**
     * Xác minh mã giao dịch (transactionId) từ cổng thanh toán có tồn tại, đã ở trạng thái SUCCESS,
     * khớp số tiền gói cước và chưa từng bị sử dụng (chống bypass hoặc replay thanh toán).
     */
    public synchronized PaymentSessionDTO verifyAndConsumeSubscriptionPayment(String transactionId, double requiredAmount) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("Valid payment transactionId is required to activate a paid subscription plan");
        }
        String normalizedTx = transactionId.trim();
        PaymentSessionDTO matched = sessions.values().stream()
                .filter(s -> s != null && normalizedTx.equals(s.getTransactionId()))
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException(
                        "Payment verification failed: transaction '" + normalizedTx + "' was not found in payment gateway"
                ));

        if (!"SUCCESS".equalsIgnoreCase(matched.getStatus())) {
            throw new AccessDeniedException(
                    "Payment verification failed: transaction '" + normalizedTx + "' is not completed (status=" + matched.getStatus() + ")"
            );
        }
        if (matched.isConsumed()) {
            throw new AccessDeniedException(
                    "Payment verification failed: transaction '" + normalizedTx + "' has already been used"
            );
        }
        // Thanh toán gói cước SaaS luôn tạo session với storeId == null (thanh toán về nền tảng POS Pro)
        if (matched.getStoreId() != null) {
            throw new AccessDeniedException(
                    "Payment verification failed: POS order payment transaction cannot be used for SaaS subscription billing"
            );
        }
        double expectedVnd = Math.max(1000.0, Math.round(requiredAmount));
        double paidAmount = matched.getAmount() != null ? matched.getAmount() : 0.0;
        if (paidAmount + 0.01 < expectedVnd) {
            throw new AccessDeniedException(
                    "Payment verification failed: paid amount (" + paidAmount + ") is less than plan price (" + expectedVnd + ")"
            );
        }

        matched.setConsumed(true);
        matched.setUpdatedAt(LocalDateTime.now());
        return sanitizePublicView(matched);
    }

    private boolean isValidExpiry(String expiry) {
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

    private String detectCardBrand(String number) {
        if (number.startsWith("4")) return "Visa";
        if (number.matches("^5[1-5].*") || number.matches("^2(2[2-9]|[3-6]\\d|7[01]|720).*")) return "Mastercard";
        if (number.startsWith("35")) return "JCB";
        if (number.startsWith("9704")) return "Napas";
        return "Visa/Debit";
    }

    private String resolveBankBin(String bankName) {
        if (bankName == null) return "970422";
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

    private String detectLanIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String ip = addr.getHostAddress();
                        if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "localhost";
    }
}
