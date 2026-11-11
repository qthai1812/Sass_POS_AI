package com.zosh.mapper;

import com.zosh.domain.StoreStatus;
import com.zosh.modal.Store;
import com.zosh.modal.StoreContact;
import com.zosh.modal.StorePaymentInfo;
import com.zosh.modal.User;
import com.zosh.payload.dto.StoreDTO;

public class StoreMapper {
    public static StoreDTO toDTO(Store store) {
        if (store == null) {
            return null;
        }
        StoreDTO storeDTO = new StoreDTO();
        storeDTO.setId(store.getId());
        storeDTO.setBrand(store.getBrand());
        storeDTO.setDescription(store.getDescription());
        storeDTO.setStoreAdmin(store.getStoreAdmin() != null ? UserMapper.toDTO(store.getStoreAdmin()) : null);
        storeDTO.setStoreType(store.getStoreType());
        storeDTO.setContact(store.getContact());
        storeDTO.setPaymentInfo(store.getPaymentInfo() != null ? store.getPaymentInfo() : new StorePaymentInfo());
        storeDTO.setCreatedAt(store.getCreatedAt());
        storeDTO.setUpdatedAt(store.getUpdatedAt());
        storeDTO.setStatus(store.getStatus());
        storeDTO.setRejectionReason(store.getRejectionReason());
        storeDTO.setCommissionRate(store.getCommissionRate() != null ? store.getCommissionRate() : 2.5);
        storeDTO.setCurrency(store.getCurrency() != null ? store.getCurrency() : "VND");
        storeDTO.setTaxRate(store.getTaxRate() != null ? store.getTaxRate() : 10.0);
        storeDTO.setTimezone(store.getTimezone() != null ? store.getTimezone() : "Asia/Ho_Chi_Minh");
        storeDTO.setDateFormat(store.getDateFormat() != null ? store.getDateFormat() : "DD/MM/YYYY");
        storeDTO.setReceiptFooter(store.getReceiptFooter());
        return storeDTO;
    }

    public static Store toEntity(StoreDTO storeDTO, User storeAdmin) {
        Store store = new Store();
        store.setBrand(storeDTO.getBrand());
        store.setDescription(storeDTO.getDescription());
        store.setStoreAdmin(storeAdmin);
        store.setStoreType(storeDTO.getStoreType());
        store.setContact(storeDTO.getContact());
        store.setPaymentInfo(storeDTO.getPaymentInfo() != null ? storeDTO.getPaymentInfo() : new StorePaymentInfo());
        store.setCommissionRate(2.5);
        store.setStatus(StoreStatus.PENDING);
        if (storeDTO.getCurrency() != null) {
            store.setCurrency(storeDTO.getCurrency());
        }
        if (storeDTO.getTaxRate() != null) {
            store.setTaxRate(storeDTO.getTaxRate());
        }
        if (storeDTO.getTimezone() != null) {
            store.setTimezone(storeDTO.getTimezone());
        }
        if (storeDTO.getDateFormat() != null) {
            store.setDateFormat(storeDTO.getDateFormat());
        }
        if (storeDTO.getReceiptFooter() != null) {
            store.setReceiptFooter(storeDTO.getReceiptFooter());
        }
        return store;
    }

    /**
     * Cập nhật từng phần thông tin cửa hàng từ payload {@link StoreDTO}.
     * Chỉ Super Admin mới được thay đổi commissionRate, status hoặc rejectionReason.
     */
    public static void applyUpdates(Store existing, StoreDTO storeDTO, boolean isSuperAdmin) {
        if (existing == null || storeDTO == null) {
            return;
        }
        if (storeDTO.getBrand() != null) {
            existing.setBrand(storeDTO.getBrand());
        }
        if (storeDTO.getDescription() != null) {
            existing.setDescription(storeDTO.getDescription());
        }
        if (storeDTO.getStoreType() != null) {
            existing.setStoreType(storeDTO.getStoreType());
        }
        if (storeDTO.getCurrency() != null) {
            existing.setCurrency(storeDTO.getCurrency());
        }
        if (storeDTO.getTaxRate() != null && storeDTO.getTaxRate() >= 0) {
            existing.setTaxRate(storeDTO.getTaxRate());
        }
        if (storeDTO.getTimezone() != null) {
            existing.setTimezone(storeDTO.getTimezone());
        }
        if (storeDTO.getDateFormat() != null) {
            existing.setDateFormat(storeDTO.getDateFormat());
        }
        if (storeDTO.getReceiptFooter() != null) {
            existing.setReceiptFooter(storeDTO.getReceiptFooter());
        }
        if (isSuperAdmin) {
            if (storeDTO.getCommissionRate() != null) {
                existing.setCommissionRate(storeDTO.getCommissionRate());
            }
            if (storeDTO.getStatus() != null) {
                existing.setStatus(storeDTO.getStatus());
            }
            if (storeDTO.getRejectionReason() != null) {
                existing.setRejectionReason(storeDTO.getRejectionReason());
            }
        }
        // Khi Chủ cửa hàng cập nhật lại thông tin của cửa hàng đang ở trạng thái REJECTED -> tự động chuyển về PENDING để chờ duyệt lại
        if (existing.getStatus() == StoreStatus.REJECTED && !isSuperAdmin) {
            existing.setStatus(StoreStatus.PENDING);
            existing.setRejectionReason(null);
        }
        if (storeDTO.getContact() != null) {
            existing.setContact(mergeContact(existing.getContact(), storeDTO.getContact()));
        }
        if (storeDTO.getPaymentInfo() != null) {
            existing.setPaymentInfo(mergePaymentInfo(existing.getPaymentInfo(), storeDTO.getPaymentInfo()));
        }
    }

    private static StoreContact mergeContact(StoreContact current, StoreContact incoming) {
        StoreContact base = current != null ? current : new StoreContact();
        return StoreContact.builder()
                .address(incoming.getAddress() != null ? incoming.getAddress() : base.getAddress())
                .phone(incoming.getPhone() != null ? incoming.getPhone() : base.getPhone())
                .email(incoming.getEmail() != null ? incoming.getEmail() : base.getEmail())
                .build();
    }

    private static StorePaymentInfo mergePaymentInfo(StorePaymentInfo current, StorePaymentInfo incoming) {
        StorePaymentInfo base = current != null ? current : new StorePaymentInfo();
        return StorePaymentInfo.builder()
                .acceptCash(incoming.getAcceptCash() != null ? incoming.getAcceptCash() : base.getAcceptCash())
                .acceptMomo(incoming.getAcceptMomo() != null ? incoming.getAcceptMomo() : base.getAcceptMomo())
                .acceptCard(incoming.getAcceptCard() != null ? incoming.getAcceptCard() : base.getAcceptCard())
                .momoPhone(incoming.getMomoPhone() != null ? incoming.getMomoPhone() : base.getMomoPhone())
                .momoOwnerName(incoming.getMomoOwnerName() != null ? incoming.getMomoOwnerName() : base.getMomoOwnerName())
                .momoQrImage(incoming.getMomoQrImage() != null ? incoming.getMomoQrImage() : base.getMomoQrImage())
                .cardBankName(incoming.getCardBankName() != null ? incoming.getCardBankName() : base.getCardBankName())
                .cardNumber(incoming.getCardNumber() != null ? incoming.getCardNumber() : base.getCardNumber())
                .cardHolderName(incoming.getCardHolderName() != null ? incoming.getCardHolderName() : base.getCardHolderName())
                .cardExpiry(incoming.getCardExpiry() != null ? incoming.getCardExpiry() : base.getCardExpiry())
                .build();
    }
}
