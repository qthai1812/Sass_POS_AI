package com.zosh.mapper;

import com.zosh.modal.Store;
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
        store.setStatus(com.zosh.domain.StoreStatus.PENDING);
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
}
