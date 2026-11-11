package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Order;
import com.zosh.modal.PlatformPaymentConfig;
import com.zosh.modal.Store;
import com.zosh.modal.Subscription;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.modal.User;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.UserService;
import com.zosh.service.payment.CardPaymentValidator;
import com.zosh.service.payment.PaymentEnvironmentPolicy;
import com.zosh.service.payment.PaymentFulfillmentCoordinator;
import com.zosh.service.payment.PaymentSessionStore;
import com.zosh.service.payment.PlatformPaymentConfigService;
import com.zosh.service.payment.PlatformPaymentConfigService.RecipientDetails;
import com.zosh.service.payment.SepayWebhookHandler;
import com.zosh.service.payment.VietQrGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentGatewayServiceImpl implements PaymentGatewayService {

    private final StoreRepository storeRepository;
    private final OrderRepository orderRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final AccessControlService accessControl;
    private final UserService userService;

    private final PaymentEnvironmentPolicy environmentPolicy;
    private final VietQrGenerator vietQrGenerator;
    private final PlatformPaymentConfigService platformConfigService;
    private final PaymentSessionStore sessionStore;
    private final CardPaymentValidator cardPaymentValidator;
    private final PaymentFulfillmentCoordinator fulfillmentCoordinator;
    private final SepayWebhookHandler sepayWebhookHandler;

    @Override
    public boolean isSimulationAllowed() {
        return environmentPolicy.isSimulationAllowed();
    }

    /** Trả về bản sao DTO đã ẩn webhookToken trên các endpoint công khai (polling / webhook response). */
    @Override
    public PaymentSessionDTO sanitizePublicView(PaymentSessionDTO session) {
        if (session == null) {
            return null;
        }
        return session.toBuilder().webhookToken(null).build();
    }

    // =========================================================================
    // CẤU HÌNH VÍ / TÀI KHOẢN NỀN TẢNG
    // =========================================================================

    @Override
    public PlatformPaymentConfig getPublicPlatformConfig() {
        return platformConfigService.getPublicPlatformConfig();
    }

    @Override
    public PlatformPaymentConfig getOrCreatePlatformConfig() {
        return platformConfigService.getOrCreatePlatformConfig();
    }

    @Override
    public PlatformPaymentConfig updatePlatformConfig(PlatformPaymentConfig payload) {
        return platformConfigService.updatePlatformConfig(payload);
    }

    // =========================================================================
    // KHỞI TẠO & TRUY VẤN PHIÊN THANH TOÁN
    // =========================================================================

    @Override
    @Transactional
    public PaymentSessionDTO createSession(CreateSessionRequest req) {
        User currentUser = requireAuthenticatedUser();

        SessionTarget target = resolveSessionTarget(req, currentUser);
        RecipientDetails recipient = platformConfigService.resolveRecipientDetails(target.storeId(), currentUser);

        String sessionId = vietQrGenerator.generateSessionId();
        String refCode = vietQrGenerator.generateReferenceCode();
        String webhookToken = vietQrGenerator.generateWebhookToken();
        String bankBin = vietQrGenerator.resolveBankBin(recipient.bankName());
        long amountVnd = Math.max(1000L, Math.round(target.amount()));

        String vietQrImageUrl = vietQrGenerator.buildVietQrImageUrl(
                bankBin, recipient.accountForVietQr(), amountVnd, refCode, recipient.storeName(), recipient.momoName());
        String mobileCheckoutUrl = vietQrGenerator.buildMobileCheckoutUrl(
                environmentPolicy.resolveBackendBaseUrl(), sessionId);
        String qrImageForMobileCheckout = vietQrGenerator.buildQrServerImageUrl(mobileCheckoutUrl);

        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId(sessionId)
                .storeId(target.storeId())
                .storeName(recipient.storeName())
                .orderId(req.getOrderId())
                .subscriptionId(req.getSubscriptionId())
                .planId(target.planId())
                .createdByUserId(currentUser.getId())
                .amount((double) amountVnd)
                .method(req.getMethod() != null ? req.getMethod().toUpperCase() : "MOMO")
                .status("PENDING")
                .referenceCode(refCode)
                .providerName("MOMO".equalsIgnoreCase(req.getMethod())
                        ? "MoMo / Napas247 VietQR" : "Visa / Mastercard 3DS Gateway")
                .providerMessage("Đang chờ thông báo xác nhận giao dịch từ bên thứ 3...")
                .recipientPhone(recipient.momoPhone())
                .recipientName(recipient.momoName())
                .bankBin(bankBin)
                .bankName(recipient.bankName())
                .bankAccount(recipient.accountForVietQr())
                .vietQrImageUrl(vietQrImageUrl)
                .mobileCheckoutUrl(mobileCheckoutUrl)
                .qrImageForMobileCheckout(qrImageForMobileCheckout)
                .webhookToken(webhookToken)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .consumed(false)
                .build();

        sessionStore.saveNewSession(session);

        if (req.getOrderId() != null) {
            orderRepository.findByIdWithLock(req.getOrderId()).ifPresent(order -> {
                order.setPaymentSessionId(sessionId);
                orderRepository.save(order);
            });
        }
        return isSimulationAllowed() ? session : sanitizePublicView(session);
    }

    @Override
    public PaymentSessionDTO getSessionForViewer(String sessionId) {
        User currentUser = requireAuthenticatedUser();
        PaymentSessionDTO session = getRawSession(sessionId);
        if (session == null) {
            return null;
        }
        assertCanAccessSession(currentUser, session);
        return sanitizePublicView(session);
    }

    @Override
    public PaymentSessionDTO getRawSession(String sessionId) {
        return sessionStore.getRawSession(sessionId);
    }

    // =========================================================================
    // LIÊN KẾT ĐƠN HÀNG / GÓI CƯỚC VỚI PHIÊN THANH TOÁN
    // =========================================================================

    @Override
    @Transactional
    public PaymentSessionDTO linkOrderToSession(String sessionId, Long orderId) {
        if (sessionId == null || sessionId.isBlank() || orderId == null) {
            return null;
        }
        PaymentSessionDTO session = sessionStore.findAndLockSession(sessionId);
        if (session == null) {
            return null;
        }
        Order order = orderRepository.findByIdWithLock(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng #" + orderId));

        validateLinkOrderConstraints(session, order, orderId);

        session.setOrderId(orderId);
        session.setUpdatedAt(LocalDateTime.now());
        if ("SUCCESS".equalsIgnoreCase(session.getStatus())) {
            fulfillmentCoordinator.fulfillOnSuccess(session);
        }
        sessionStore.syncSessionToDb(session);
        return sanitizePublicView(session);
    }

    @Override
    @Transactional
    public PaymentSessionDTO linkSubscriptionToSession(String sessionId, Long subscriptionId) {
        if (sessionId == null || sessionId.isBlank() || subscriptionId == null) {
            return null;
        }
        PaymentSessionDTO session = sessionStore.findAndLockSession(sessionId);
        if (session == null) {
            return null;
        }
        Subscription sub = subscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đăng ký gói cước #" + subscriptionId));

        validateLinkSubscriptionConstraints(session, sub, subscriptionId);

        session.setSubscriptionId(subscriptionId);
        session.setUpdatedAt(LocalDateTime.now());
        if ("SUCCESS".equalsIgnoreCase(session.getStatus())) {
            fulfillmentCoordinator.fulfillOnSuccess(session);
        }
        sessionStore.syncSessionToDb(session);
        return sanitizePublicView(session);
    }

    // =========================================================================
    // WEBHOOK & XÁC THỰC THẺ 3DS
    // =========================================================================

    @Override
    public boolean verifyWebhookSignature(PaymentSessionDTO session, String providedSignature) {
        if (session == null || session.getWebhookToken() == null
                || providedSignature == null || providedSignature.isBlank()) {
            return false;
        }
        byte[] expected = session.getWebhookToken().getBytes(StandardCharsets.UTF_8);
        byte[] actual = providedSignature.trim().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    @Override
    @Transactional
    public PaymentSessionDTO processWebhook(String sessionId, String signatureHeader, WebhookRequest req) {
        if (!isSimulationAllowed()) {
            throw new AccessDeniedException("Tính năng giả lập Webhook đã bị tắt trên môi trường Production.");
        }
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        PaymentSessionDTO session = sessionStore.findAndLockSession(sessionId);
        if (session == null) {
            return null;
        }

        String candidateSig = (signatureHeader != null && !signatureHeader.isBlank())
                ? signatureHeader
                : (req != null ? req.getSignature() : null);
        if (!verifyWebhookSignature(session, candidateSig)) {
            throw new AccessDeniedException("Invalid or missing webhook signature (X-Webhook-Signature)");
        }

        // Trạng thái SUCCESS là bất biến một chiều (không cho phép ghi đè ngược về FAILED)
        if (session.isConsumed() || "SUCCESS".equalsIgnoreCase(session.getStatus())) {
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
            session.setProviderMessage(req != null && req.getMessage() != null
                    ? req.getMessage()
                    : "Webhook IPN: Đã nhận đủ " + String.format("%,.0f", session.getAmount()) + "₫ (Mã GD: " + txId + ")");
            fulfillmentCoordinator.fulfillOnSuccess(session);
        } else {
            session.setProviderMessage(req != null && req.getMessage() != null
                    ? req.getMessage()
                    : "Giao dịch bị từ chối hoặc khách hàng đã hủy thanh toán.");
        }

        sessionStore.syncSessionToDb(session);
        return sanitizePublicView(session);
    }

    @Override
    @Transactional
    public PaymentSessionDTO processSepayWebhook(String authorizationHeader, SepayWebhookPayload payload) {
        PaymentSessionDTO result = sepayWebhookHandler.handle(authorizationHeader, payload);
        return sanitizePublicView(result);
    }

    @Override
    @Transactional
    public PaymentSessionDTO authorizeCard(String sessionId, CardAuthorizeRequest req) {
        if (!isSimulationAllowed()) {
            throw new AccessDeniedException("Thanh toán thẻ giả lập đã bị tắt trên môi trường Production.");
        }
        User currentUser = requireAuthenticatedUser();
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        PaymentSessionDTO session = sessionStore.findAndLockSession(sessionId);
        if (session == null) {
            return null;
        }
        assertCanAccessSession(currentUser, session);
        if (!"CARD".equalsIgnoreCase(session.getMethod())) {
            throw new IllegalArgumentException("Phiên thanh toán này không thuộc phương thức Thẻ (CARD).");
        }
        if (session.isConsumed() || "SUCCESS".equalsIgnoreCase(session.getStatus())) {
            return sanitizePublicView(session);
        }

        boolean approved = cardPaymentValidator.processAuthorization(session, req);
        if (approved) {
            fulfillmentCoordinator.fulfillOnSuccess(session);
        }
        sessionStore.syncSessionToDb(session);
        return sanitizePublicView(session);
    }

    // =========================================================================
    // XÁC MINH & TIÊU THỤ PHIÊN (CHỐNG REPLAY / BYPASS)
    // =========================================================================

    @Override
    @Transactional
    public PaymentSessionDTO verifyAndConsumeSubscriptionPayment(String transactionId, double requiredAmount) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new IllegalArgumentException("Valid payment transactionId is required to activate a paid subscription plan");
        }
        String normalizedTx = transactionId.trim();
        PaymentSessionDTO matched = sessionStore.findAndLockByTxOrSessionId(normalizedTx);
        if (matched == null) {
            throw new AccessDeniedException(
                    "Payment verification failed: transaction '" + normalizedTx + "' was not found in payment gateway"
            );
        }
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
        sessionStore.syncSessionToDb(matched);
        return sanitizePublicView(matched);
    }

    @Override
    @Transactional
    public PaymentSessionDTO verifyAndConsumePosOrderPayment(
            String txOrSessionId,
            Long branchStoreId,
            double requiredAmount,
            Long targetOrderId
    ) {
        if (txOrSessionId == null || txOrSessionId.isBlank()) {
            return null;
        }
        String key = txOrSessionId.trim();
        PaymentSessionDTO matched = sessionStore.findAndLockByTxOrSessionId(key);
        if (matched == null) {
            throw new AccessDeniedException(
                    "Không tìm thấy phiên thanh toán '" + key + "' trên cổng thanh toán."
            );
        }
        if (!"SUCCESS".equalsIgnoreCase(matched.getStatus())) {
            throw new AccessDeniedException(
                    "Giao dịch '" + key + "' chưa hoàn tất thanh toán (trạng thái: " + matched.getStatus() + ")."
            );
        }
        // Nếu session đã được tiêu thụ cho chính đơn hàng này (do webhook tự động hoàn tất trước đó) thì cho phép idempotent
        if (matched.isConsumed()) {
            if (targetOrderId != null && targetOrderId.equals(matched.getOrderId())) {
                return sanitizePublicView(matched);
            }
            throw new AccessDeniedException(
                    "Mã giao dịch '" + key + "' đã được sử dụng cho một đơn hàng khác."
            );
        }
        if (matched.getStoreId() == null || (branchStoreId != null && !matched.getStoreId().equals(branchStoreId))) {
            throw new AccessDeniedException("Phiên thanh toán không thuộc cửa hàng hiện tại.");
        }
        double expectedVnd = Math.max(1000.0, Math.round(requiredAmount));
        double paidAmount = matched.getAmount() != null ? matched.getAmount() : 0.0;
        if (paidAmount + 1.0 < expectedVnd) {
            throw new AccessDeniedException(
                    "Số tiền đã thanh toán (" + paidAmount + "đ) thấp hơn tổng tiền đơn hàng (" + expectedVnd + "đ)."
            );
        }
        if (targetOrderId != null && matched.getOrderId() == null) {
            matched.setOrderId(targetOrderId);
        }
        matched.setConsumed(true);
        matched.setUpdatedAt(LocalDateTime.now());
        sessionStore.syncSessionToDb(matched);
        return sanitizePublicView(matched);
    }

    @Override
    public PaymentSessionDTO verifyAndConsumePosOrderPayment(
            String txOrSessionId,
            Long branchStoreId,
            double requiredAmount
    ) {
        return verifyAndConsumePosOrderPayment(txOrSessionId, branchStoreId, requiredAmount, null);
    }

    // =========================================================================
    // NỘI BỘ: PHÂN QUYỀN & RÀNG BUỘC
    // =========================================================================

    private record SessionTarget(Long storeId, String planId, double amount) {
    }

    private SessionTarget resolveSessionTarget(CreateSessionRequest req, User currentUser) {
        Long effectiveStoreId = req.getStoreId();
        String effectivePlanId = (req.getPlanId() != null && !req.getPlanId().isBlank()) ? req.getPlanId().trim() : null;
        double rawAmount = req.getAmount() != null ? req.getAmount() : 10000.0;

        if (req.getOrderId() != null) {
            Order order = orderRepository.findByIdWithLock(req.getOrderId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng #" + req.getOrderId()));
            if (order.getBranch() != null) {
                if (!accessControl.canAccessBranch(currentUser, order.getBranch())) {
                    throw new AccessDeniedException("Bạn không có quyền truy cập chi nhánh của đơn hàng này.");
                }
                if (order.getBranch().getStore() != null) {
                    Long orderStoreId = order.getBranch().getStore().getId();
                    if (effectiveStoreId != null && !effectiveStoreId.equals(orderStoreId)) {
                        throw new AccessDeniedException("Đơn hàng không thuộc cửa hàng đã chọn.");
                    }
                    effectiveStoreId = orderStoreId;
                }
            }
            if (order.getStatus() != OrderStatus.PENDING) {
                throw new IllegalArgumentException("Chỉ có thể tạo phiên thanh toán cho đơn hàng đang ở trạng thái PENDING.");
            }
            if (order.getTotalAmount() != null && order.getTotalAmount() > 0) {
                rawAmount = order.getTotalAmount();
            }
        }

        if (req.getSubscriptionId() != null) {
            Subscription sub = subscriptionRepository.findById(req.getSubscriptionId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đăng ký gói cước #" + req.getSubscriptionId()));
            if (sub.getStore() != null) {
                accessControl.assertCanAccessStore(currentUser, sub.getStore());
            }
            effectiveStoreId = null;
            if (sub.getAmount() != null && sub.getAmount() > 0) {
                rawAmount = sub.getAmount();
            }
        } else if (effectivePlanId != null) {
            Long numericPlanId;
            try {
                numericPlanId = Long.parseLong(effectivePlanId);
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Mã gói cước không hợp lệ: " + effectivePlanId);
            }
            SubscriptionPlan plan = subscriptionPlanRepository.findById(numericPlanId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy gói cước #" + effectivePlanId));
            effectiveStoreId = null;
            if (plan.getPrice() != null && plan.getPrice() > 0) {
                rawAmount = plan.getPrice();
            }
        }

        return new SessionTarget(effectiveStoreId, effectivePlanId, rawAmount);
    }

    private void validateLinkOrderConstraints(PaymentSessionDTO session, Order order, Long orderId) {
        User currentUser = resolveAuthenticatedUserOrNull();
        if (currentUser != null && order.getBranch() != null
                && !accessControl.canAccessBranch(currentUser, order.getBranch())) {
            throw new AccessDeniedException("Bạn không có quyền truy cập chi nhánh của đơn hàng này.");
        }
        Long orderStoreId = (order.getBranch() != null && order.getBranch().getStore() != null)
                ? order.getBranch().getStore().getId()
                : null;
        if (session.getStoreId() == null || (orderStoreId != null && !session.getStoreId().equals(orderStoreId))) {
            throw new AccessDeniedException("Phiên thanh toán không thuộc cửa hàng của đơn hàng này.");
        }
        if (session.isConsumed() && !orderId.equals(session.getOrderId())) {
            throw new AccessDeniedException("Phiên thanh toán này đã được sử dụng cho một đơn hàng khác.");
        }
        if (session.getOrderId() != null && !session.getOrderId().equals(orderId)) {
            throw new AccessDeniedException("Phiên thanh toán này đã được gắn với đơn hàng #" + session.getOrderId());
        }
        double requiredAmount = order.getTotalAmount() != null ? Math.max(1000.0, Math.round(order.getTotalAmount())) : 1000.0;
        double sessionAmount = session.getAmount() != null ? session.getAmount() : 0.0;
        if (sessionAmount + 1.0 < requiredAmount) {
            throw new AccessDeniedException("Số tiền của phiên thanh toán thấp hơn tổng tiền đơn hàng.");
        }
    }

    private void validateLinkSubscriptionConstraints(PaymentSessionDTO session, Subscription sub, Long subscriptionId) {
        User currentUser = resolveAuthenticatedUserOrNull();
        if (currentUser != null && sub.getStore() != null) {
            accessControl.assertCanAccessStore(currentUser, sub.getStore());
        }
        if (session.getStoreId() != null) {
            throw new AccessDeniedException("Phiên thanh toán đơn hàng POS không thể gắn cho gói cước SaaS.");
        }
        if (session.isConsumed() && !subscriptionId.equals(session.getSubscriptionId())) {
            throw new AccessDeniedException("Phiên thanh toán này đã được sử dụng.");
        }
        if (session.getSubscriptionId() != null && !session.getSubscriptionId().equals(subscriptionId)) {
            throw new AccessDeniedException("Phiên thanh toán này đã được gắn với gói cước khác.");
        }
        double requiredAmount = sub.getAmount() != null ? Math.max(1000.0, Math.round(sub.getAmount())) : 1000.0;
        double sessionAmount = session.getAmount() != null ? session.getAmount() : 0.0;
        if (sessionAmount + 1.0 < requiredAmount) {
            throw new AccessDeniedException("Số tiền của phiên thanh toán thấp hơn giá gói cước.");
        }
    }

    private User requireAuthenticatedUser() {
        try {
            User u = userService.getCurrentUserAllowingBlockedStore();
            if (u == null) {
                throw new AccessDeniedException("Vui lòng đăng nhập để thực hiện giao dịch thanh toán.");
            }
            return u;
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("Vui lòng đăng nhập để thực hiện giao dịch thanh toán.");
        }
    }

    private User resolveAuthenticatedUserOrNull() {
        try {
            return userService.getCurrentUserAllowingBlockedStore();
        } catch (Exception e) {
            return null;
        }
    }

    private void assertCanAccessSession(User user, PaymentSessionDTO session) {
        if (user == null || session == null) {
            throw new AccessDeniedException("Bạn không có quyền truy cập phiên thanh toán này.");
        }
        if (user.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            return;
        }
        if (session.getStoreId() != null) {
            Store store = storeRepository.findById(session.getStoreId())
                    .orElseThrow(() -> new AccessDeniedException("Không tìm thấy cửa hàng của phiên thanh toán."));
            accessControl.assertCanAccessStore(user, store);
        } else {
            if (session.getCreatedByUserId() != null && !session.getCreatedByUserId().equals(user.getId())) {
                Store userStore = accessControl.resolveStoreOfUser(user);
                User creator = null;
                if (userStore != null && userStore.getStoreAdmin() != null
                        && userStore.getStoreAdmin().getId().equals(session.getCreatedByUserId())) {
                    creator = userStore.getStoreAdmin();
                }
                if (creator == null) {
                    throw new AccessDeniedException("Phiên thanh toán gói cước này không thuộc tài khoản của bạn.");
                }
            }
            if (user.getRole() != UserRole.ROLE_STORE_OWNER) {
                throw new AccessDeniedException("Chỉ Chủ cửa hàng mới có quyền truy cập phiên thanh toán gói cước.");
            }
        }
    }
}
