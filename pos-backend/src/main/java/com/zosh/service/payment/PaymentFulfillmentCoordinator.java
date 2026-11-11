package com.zosh.service.payment;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Order;
import com.zosh.modal.Subscription;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.order.CustomerLoyaltyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Tự động hoàn tất đơn hàng PENDING hoặc kích hoạt gói cước SaaS PENDING ngay khi
 * phiên thanh toán chuyển sang trạng thái SUCCESS (từ Webhook SePay / 3DS / Link thủ công).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentFulfillmentCoordinator {

    private final OrderRepository orderRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PlanLimitChecker planLimitChecker;
    private final CustomerLoyaltyService loyaltyService;

    public void fulfillOnSuccess(PaymentSessionDTO session) {
        if (session == null || !"SUCCESS".equalsIgnoreCase(session.getStatus())) {
            return;
        }
        if (session.getOrderId() != null) {
            fulfillOrder(session);
        }
        if (session.getSubscriptionId() != null) {
            fulfillSubscription(session);
        }
    }

    private void fulfillOrder(PaymentSessionDTO session) {
        try {
            Order order = orderRepository.findByIdWithLock(session.getOrderId()).orElse(null);
            if (order == null || order.getStatus() != OrderStatus.PENDING) {
                return;
            }
            order.setStatus(OrderStatus.COMPLETED);
            order.setPaidAt(LocalDateTime.now());
            order.setPaymentSessionId(session.getSessionId());
            order.setPaymentTransactionId(session.getTransactionId());
            double totalAmt = order.getTotalAmount() != null ? order.getTotalAmount() : 0.0;
            loyaltyService.awardOnCompletion(order, totalAmt);
            orderRepository.save(order);
            session.setConsumed(true);
            log.info("Auto-completed PENDING order {} on payment session {} success (tx={})",
                    order.getId(), session.getSessionId(), session.getTransactionId());
        } catch (Exception e) {
            log.warn("Could not auto-complete linked order {} for session {}: {}",
                    session.getOrderId(), session.getSessionId(), e.getMessage());
        }
    }

    private void fulfillSubscription(PaymentSessionDTO session) {
        try {
            Subscription sub = subscriptionRepository.findById(session.getSubscriptionId()).orElse(null);
            if (sub == null || sub.getStatus() != SubscriptionStatus.PENDING) {
                return;
            }
            boolean isYearly = resolveYearlyBillingAndCheckLimits(sub);
            cancelPreviousActiveSubscriptions(sub);

            LocalDateTime now = LocalDateTime.now();
            sub.setStatus(SubscriptionStatus.ACTIVE);
            sub.setTransactionId(session.getTransactionId());
            sub.setStartDate(now);
            sub.setEndDate(isYearly ? now.plusYears(1) : now.plusMonths(1));
            subscriptionRepository.save(sub);
            session.setConsumed(true);
            log.info("Auto-activated PENDING subscription {} on payment session {} success",
                    sub.getId(), session.getSessionId());
        } catch (Exception e) {
            log.warn("Could not auto-activate linked subscription {} for session {}: {}",
                    session.getSubscriptionId(), session.getSessionId(), e.getMessage());
        }
    }

    private boolean resolveYearlyBillingAndCheckLimits(Subscription sub) throws UserException {
        if (sub.getPlanId() == null) {
            return false;
        }
        try {
            Long numericPlanId = Long.parseLong(sub.getPlanId().trim());
            SubscriptionPlan plan = subscriptionPlanRepository.findById(numericPlanId).orElse(null);
            if (plan == null) {
                return false;
            }
            if (sub.getStore() != null) {
                planLimitChecker.assertCanSwitchTo(sub.getStore(), plan);
            }
            return "YEARLY".equalsIgnoreCase(plan.getBillingCycle());
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private void cancelPreviousActiveSubscriptions(Subscription currentSub) {
        List<Subscription> existingActive = subscriptionRepository.findByStoreIdAndStatusIn(
                currentSub.getStore().getId(),
                List.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL)
        );
        for (Subscription oldSub : existingActive) {
            if (!oldSub.getId().equals(currentSub.getId())) {
                oldSub.setStatus(SubscriptionStatus.CANCELLED);
                subscriptionRepository.save(oldSub);
            }
        }
    }
}
