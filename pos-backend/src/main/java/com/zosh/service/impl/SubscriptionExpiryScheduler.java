package com.zosh.service.impl;

import com.zosh.service.OrderService;
import com.zosh.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tự động chuyển các gói cước đã quá hạn (endDate &lt; hiện tại) từ ACTIVE sang EXPIRED
 * và tự động hủy các đơn hàng PENDING quá 30 phút chưa thanh toán để giải phóng tồn kho.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionExpiryScheduler {

    private final SubscriptionService subscriptionService;
    private final OrderService orderService;

    @Scheduled(initialDelay = 30_000, fixedDelay = 3_600_000)
    public void expireOverdueSubscriptions() {
        try {
            subscriptionService.expireOverdueSubscriptions();
        } catch (Exception e) {
            log.error("Failed to expire overdue subscriptions: {}", e.getMessage(), e);
        }
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 300_000)
    public void cancelExpiredPendingOrders() {
        try {
            orderService.cancelExpiredPendingOrders();
        } catch (Exception e) {
            log.error("Failed to cancel expired pending orders: {}", e.getMessage(), e);
        }
    }
}
