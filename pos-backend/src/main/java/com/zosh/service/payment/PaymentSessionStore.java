package com.zosh.service.payment;

import com.zosh.modal.PaymentSession;
import com.zosh.modal.Store;
import com.zosh.repository.PaymentSessionRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;

/**
 * Lưu trữ và đồng bộ phiên thanh toán giữa bộ nhớ đệm RAM (ConcurrentHashMap) và MySQL (`payment_sessions`).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentSessionStore {

    public static final int MAX_CACHED_SESSIONS = 2000;
    public static final long SESSION_TTL_HOURS = 2L;

    private final PaymentSessionRepository paymentSessionRepository;
    private final StoreRepository storeRepository;
    private final PaymentEnvironmentPolicy environmentPolicy;
    private final VietQrGenerator vietQrGenerator;

    private final Map<String, PaymentSessionDTO> sessions = new ConcurrentHashMap<>();

    public void saveNewSession(PaymentSessionDTO session) {
        evictExpiredSessions();
        sessions.put(session.getSessionId(), session);
        syncSessionToDb(session);
    }

    public void syncSessionToDb(PaymentSessionDTO dto) {
        if (dto == null || dto.getSessionId() == null) {
            return;
        }
        try {
            PaymentSession entity = paymentSessionRepository.findById(dto.getSessionId())
                    .orElseGet(() -> PaymentSession.builder().sessionId(dto.getSessionId()).build());
            entity.setAmount(dto.getAmount());
            entity.setProvider(dto.getMethod());
            entity.setDescription(dto.getStoreId() != null ? String.valueOf(dto.getStoreId()) : null);
            entity.setStoreId(dto.getStoreId());
            entity.setPlanId(dto.getPlanId());
            entity.setCreatedByUserId(dto.getCreatedByUserId());
            entity.setStatus(dto.getStatus());
            entity.setTransactionId(dto.getTransactionId());
            entity.setProviderTxId(dto.getProviderTxId());
            entity.setMaskedCardNumber(dto.getMaskedCardNumber());
            entity.setCardBrand(dto.getCardBrand());
            entity.setRecipientBank(dto.getBankName());
            entity.setRecipientAccount(dto.getBankAccount() != null ? dto.getBankAccount() : dto.getRecipientPhone());
            entity.setRecipientName(dto.getRecipientName());
            entity.setTransferContent(dto.getReferenceCode());
            entity.setVietQrImageUrl(dto.getVietQrImageUrl());
            entity.setFailureReason(dto.getProviderMessage());
            entity.setWebhookToken(dto.getWebhookToken());
            entity.setOrderId(dto.getOrderId());
            entity.setSubscriptionId(dto.getSubscriptionId());
            LocalDateTime created = dto.getCreatedAt() != null ? dto.getCreatedAt() : LocalDateTime.now();
            entity.setCreatedAt(created);
            entity.setExpiresAt(created.plusHours(SESSION_TTL_HOURS));
            entity.setCompletedAt(dto.getPaidAt());
            entity.setConsumed(dto.isConsumed());
            paymentSessionRepository.save(entity);
        } catch (Exception e) {
            log.error("Could not persist PaymentSession {}: {}", dto.getSessionId(), e.getMessage());
            throw new IllegalStateException("Không thể lưu phiên thanh toán vào cơ sở dữ liệu: " + e.getMessage(), e);
        }
    }

    public PaymentSessionDTO getRawSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        String key = sessionId.trim();
        PaymentSessionDTO cached = sessions.get(key);
        if (cached != null) {
            return cached;
        }
        return paymentSessionRepository.findById(key)
                .map(this::toDtoFromDb)
                .orElse(null);
    }

    public PaymentSessionDTO findAndLockSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return null;
        }
        PaymentSession locked = paymentSessionRepository.findByIdWithLock(sessionId.trim()).orElse(null);
        return locked != null ? toDtoFromDb(locked) : getRawSession(sessionId);
    }

    public PaymentSessionDTO findAndLockByTxOrSessionId(String txOrSessionId) {
        String key = txOrSessionId.trim();
        PaymentSessionDTO matched = getRawSession(key);
        if (matched == null) {
            matched = sessions.values().stream()
                    .filter(s -> s != null && (key.equalsIgnoreCase(s.getTransactionId()) || key.equalsIgnoreCase(s.getSessionId())))
                    .findFirst()
                    .orElse(null);
        }
        if (matched == null) {
            matched = paymentSessionRepository.findAll().stream()
                    .filter(s -> key.equalsIgnoreCase(s.getTransactionId()) || key.equalsIgnoreCase(s.getSessionId()))
                    .findFirst()
                    .map(this::toDtoFromDb)
                    .orElse(null);
        }
        if (matched == null) {
            return null;
        }
        PaymentSession lockedEntity = paymentSessionRepository.findByIdWithLock(matched.getSessionId()).orElse(null);
        return lockedEntity != null ? toDtoFromDb(lockedEntity) : matched;
    }

    public PaymentSessionDTO findPendingSessionForSepay(
            Predicate<String> referenceMatcher,
            String incomingAccount,
            LocalDateTime cutoff
    ) {
        PaymentSession matchedEntity = paymentSessionRepository.findByStatusOrderByCreatedAtDesc("PENDING").stream()
                .filter(s -> !s.isConsumed())
                .filter(s -> s.getCreatedAt() == null || !s.getCreatedAt().isBefore(cutoff))
                .filter(s -> referenceMatcher.test(s.getTransferContent()))
                .filter(s -> incomingAccount.isEmpty()
                        || s.getRecipientAccount() == null
                        || s.getRecipientAccount().isBlank()
                        || s.getRecipientAccount().replaceAll("\\s+", "").equalsIgnoreCase(incomingAccount))
                .findFirst()
                .orElse(null);

        if (matchedEntity != null) {
            PaymentSession locked = paymentSessionRepository.findByIdWithLock(matchedEntity.getSessionId())
                    .orElse(matchedEntity);
            return toDtoFromDb(locked);
        }

        return sessions.values().stream()
                .filter(s -> s != null && "PENDING".equalsIgnoreCase(s.getStatus()) && !s.isConsumed())
                .filter(s -> s.getCreatedAt() == null || !s.getCreatedAt().isBefore(cutoff))
                .filter(s -> referenceMatcher.test(s.getReferenceCode()))
                .findFirst()
                .orElse(null);
    }

    public boolean existsByProviderTxId(String providerTxId) {
        return paymentSessionRepository.existsByProviderTxId(providerTxId);
    }

    public PaymentSessionDTO toDtoFromDb(PaymentSession entity) {
        if (entity == null) {
            return null;
        }
        Long parsedStoreId = resolveStoreId(entity);
        String storeName = resolveStoreName(parsedStoreId);
        String baseUrl = environmentPolicy.resolveBackendBaseUrl();
        String mobileCheckoutUrl = vietQrGenerator.buildMobileCheckoutUrl(baseUrl, entity.getSessionId());
        String qrImageForMobileCheckout = vietQrGenerator.buildQrServerImageUrl(mobileCheckoutUrl);

        PaymentSessionDTO dto = PaymentSessionDTO.builder()
                .sessionId(entity.getSessionId())
                .storeId(parsedStoreId)
                .storeName(storeName)
                .orderId(entity.getOrderId())
                .subscriptionId(entity.getSubscriptionId())
                .planId(entity.getPlanId())
                .createdByUserId(entity.getCreatedByUserId())
                .amount(entity.getAmount())
                .method(entity.getProvider())
                .status(entity.getStatus())
                .referenceCode(entity.getTransferContent())
                .transactionId(entity.getTransactionId())
                .providerTxId(entity.getProviderTxId())
                .providerName("MOMO".equalsIgnoreCase(entity.getProvider())
                        ? "MoMo / Napas247 VietQR" : "Visa / Mastercard 3DS Gateway")
                .providerMessage(entity.getFailureReason())
                .recipientPhone(entity.getRecipientAccount())
                .recipientName(entity.getRecipientName())
                .bankBin(vietQrGenerator.resolveBankBin(entity.getRecipientBank()))
                .bankName(entity.getRecipientBank())
                .bankAccount(entity.getRecipientAccount())
                .vietQrImageUrl(entity.getVietQrImageUrl())
                .mobileCheckoutUrl(mobileCheckoutUrl)
                .qrImageForMobileCheckout(qrImageForMobileCheckout)
                .maskedCardNumber(entity.getMaskedCardNumber())
                .cardBrand(entity.getCardBrand())
                .webhookToken(entity.getWebhookToken())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getCompletedAt() != null ? entity.getCompletedAt() : entity.getCreatedAt())
                .paidAt(entity.getCompletedAt())
                .consumed(entity.isConsumed())
                .build();
        sessions.put(dto.getSessionId(), dto);
        return dto;
    }

    public void evictExpiredSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(SESSION_TTL_HOURS);
        sessions.entrySet().removeIf(entry -> {
            PaymentSessionDTO s = entry.getValue();
            return s == null || s.getCreatedAt() == null || s.getCreatedAt().isBefore(cutoff);
        });
        int excess = sessions.size() - MAX_CACHED_SESSIONS;
        if (excess > 0) {
            Comparator<Map.Entry<String, PaymentSessionDTO>> evictionOrder = Comparator
                    .<Map.Entry<String, PaymentSessionDTO>, Integer>comparing(entry -> {
                        PaymentSessionDTO s = entry.getValue();
                        if (s == null || s.isConsumed() || "FAILED".equals(s.getStatus())) {
                            return 0;
                        }
                        if ("SUCCESS".equals(s.getStatus())) {
                            return 1;
                        }
                        return 2;
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

    private Long resolveStoreId(PaymentSession entity) {
        if (entity.getStoreId() != null) {
            return entity.getStoreId();
        }
        if (entity.getDescription() != null && !entity.getDescription().isBlank()) {
            try {
                return Long.parseLong(entity.getDescription().trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private String resolveStoreName(Long storeId) {
        if (storeId == null) {
            return "POS Pro Store";
        }
        Store store = storeRepository.findById(storeId).orElse(null);
        return (store != null && store.getBrand() != null) ? store.getBrand() : "POS Pro Store";
    }
}
