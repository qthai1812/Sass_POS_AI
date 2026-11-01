package com.zosh.service.impl;

import com.zosh.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tự động chuyển các gói cước đã quá hạn (endDate &lt; hiện tại) từ ACTIVE sang EXPIRED.
 * Chạy khi khởi động (sau 30s) và lặp lại mỗi giờ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionExpiryScheduler {

    private final SubscriptionService subscriptionService;

    @Scheduled(initialDelay = 30_000, fixedDelay = 3_600_000)
    public void expireOverdueSubscriptions() {
        try {
            subscriptionService.expireOverdueSubscriptions();
        } catch (Exception e) {
            log.error("Failed to expire overdue subscriptions: {}", e.getMessage(), e);
        }
    }
}
