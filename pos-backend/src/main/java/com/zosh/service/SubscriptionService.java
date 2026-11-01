package com.zosh.service;

import com.zosh.domain.PaymentGateway;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.payload.dto.PlanEntitlementsDTO;
import com.zosh.payload.dto.SubscriptionDTO;

import java.util.List;

public interface SubscriptionService {
    SubscriptionDTO subscribe(Long storeId, String planId, PaymentGateway gateway, String transactionId) throws Exception;
    SubscriptionDTO upgrade(Long storeId, String planId, PaymentGateway gateway, String transactionId) throws Exception;
    SubscriptionDTO activate(Long subscriptionId) throws Exception;
    SubscriptionDTO cancel(Long subscriptionId) throws Exception;
    SubscriptionDTO updatePaymentStatus(Long subscriptionId, SubscriptionStatus status) throws Exception;
    List<SubscriptionDTO> getStoreSubscriptions(Long storeId, SubscriptionStatus status) throws Exception;
    List<SubscriptionDTO> getAllSubscriptions(SubscriptionStatus status) throws Exception;
    List<SubscriptionDTO> getExpiringSubscriptions(int days) throws Exception;
    long countByStatus(SubscriptionStatus status) throws Exception;
    int expireOverdueSubscriptions();
    /** Quyền lợi (giới hạn, mức đã dùng, tính năng) của cửa hàng mà người dùng hiện tại thuộc về. */
    PlanEntitlementsDTO getMyEntitlements() throws Exception;
}
