package com.zosh.service.payment;

import com.zosh.modal.PlatformPaymentConfig;
import com.zosh.modal.Store;
import com.zosh.modal.StorePaymentInfo;
import com.zosh.modal.User;
import com.zosh.repository.PlatformPaymentConfigRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.AccessControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Quản lý cấu hình ví/ngân hàng nhận tiền của Nền tảng và phân giải thông tin người nhận (Store hoặc Platform).
 */
@Component
@RequiredArgsConstructor
public class PlatformPaymentConfigService {

    private final PlatformPaymentConfigRepository platformPaymentConfigRepository;
    private final StoreRepository storeRepository;
    private final AccessControlService accessControl;

    public record RecipientDetails(
            String storeName,
            String momoPhone,
            String momoName,
            String bankName,
            String accountForVietQr
    ) {
    }

    /** Bản sao cấu hình đã che số thẻ (chỉ giữ 4 số đầu và 4 số cuối) khi trả về cho các Store xem. */
    public PlatformPaymentConfig getPublicPlatformConfig() {
        PlatformPaymentConfig raw = getOrCreatePlatformConfig();
        String cardNum = raw.getCardNumber();
        String maskedCard = cardNum;
        if (cardNum != null) {
            String digits = cardNum.replaceAll("\\D", "");
            if (digits.length() >= 8) {
                maskedCard = digits.substring(0, 4) + " •••• •••• " + digits.substring(digits.length() - 4);
            }
        }
        return PlatformPaymentConfig.builder()
                .id(raw.getId())
                .acceptMomo(raw.getAcceptMomo())
                .acceptCard(raw.getAcceptCard())
                .momoPhone(raw.getMomoPhone())
                .momoOwnerName(raw.getMomoOwnerName())
                .momoQrImage(raw.getMomoQrImage())
                .cardBankName(raw.getCardBankName())
                .cardNumber(maskedCard)
                .cardHolderName(raw.getCardHolderName())
                .cardExpiry(raw.getCardExpiry())
                .updatedAt(raw.getUpdatedAt())
                .build();
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
        if (payload.getCardNumber() != null
                && !payload.getCardNumber().contains("*")
                && !payload.getCardNumber().contains("•")) {
            cfg.setCardNumber(payload.getCardNumber().trim());
        }
        if (payload.getCardHolderName() != null) cfg.setCardHolderName(payload.getCardHolderName().trim());
        if (payload.getCardExpiry() != null) cfg.setCardExpiry(payload.getCardExpiry().trim());
        cfg.setUpdatedAt(LocalDateTime.now());
        return platformPaymentConfigRepository.save(cfg);
    }

    public RecipientDetails resolveRecipientDetails(Long effectiveStoreId, User currentUser) {
        String storeName = "POS Pro Store";
        String momoPhone = null;
        String momoName = null;
        String bankName = null;
        String bankAccount = null;

        if (effectiveStoreId != null) {
            Store store = storeRepository.findById(effectiveStoreId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cửa hàng #" + effectiveStoreId));
            accessControl.assertCanAccessStore(currentUser, store);
            if (hasText(store.getBrand())) {
                storeName = store.getBrand();
            }
            StorePaymentInfo info = store.getPaymentInfo();
            if (info != null) {
                if (hasText(info.getMomoPhone())) momoPhone = info.getMomoPhone().trim();
                if (hasText(info.getMomoOwnerName())) momoName = info.getMomoOwnerName().trim();
                if (hasText(info.getCardBankName())) bankName = info.getCardBankName().trim();
                if (hasText(info.getCardNumber())) bankAccount = info.getCardNumber().trim();
                if (!hasText(momoName) && hasText(info.getCardHolderName())) {
                    momoName = info.getCardHolderName().trim();
                }
            }
        } else {
            PlatformPaymentConfig platformCfg = getOrCreatePlatformConfig();
            if (hasText(platformCfg.getMomoPhone())) momoPhone = platformCfg.getMomoPhone().trim();
            if (hasText(platformCfg.getMomoOwnerName())) momoName = platformCfg.getMomoOwnerName().trim();
            if (hasText(platformCfg.getCardBankName())) bankName = platformCfg.getCardBankName().trim();
            if (hasText(platformCfg.getCardNumber())) bankAccount = platformCfg.getCardNumber().trim();
            if (!hasText(momoName) && hasText(platformCfg.getCardHolderName())) {
                momoName = platformCfg.getCardHolderName().trim();
            }
        }

        if (!hasText(momoPhone)) momoPhone = "0901234567";
        if (!hasText(momoName)) momoName = storeName.toUpperCase();
        if (!hasText(bankName)) bankName = "MB Bank";

        String accountForVietQr = hasText(bankAccount)
                ? bankAccount.replaceAll("\\s+", "")
                : momoPhone.replaceAll("\\s+", "");

        return new RecipientDetails(storeName, momoPhone, momoName, bankName, accountForVietQr);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
