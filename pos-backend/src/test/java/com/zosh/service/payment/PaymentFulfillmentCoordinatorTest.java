package com.zosh.service.payment;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.modal.Order;
import com.zosh.modal.Store;
import com.zosh.modal.Subscription;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.order.CustomerLoyaltyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentFulfillmentCoordinatorTest {

    @Mock private OrderRepository orderRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private SubscriptionPlanRepository subscriptionPlanRepository;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private CustomerLoyaltyService loyaltyService;

    @InjectMocks
    private PaymentFulfillmentCoordinator coordinator;

    @Test
    void fulfillOnSuccess_completesPendingOrderAndAwardsLoyalty() {
        Order order = Order.builder()
                .id(10L)
                .status(OrderStatus.PENDING)
                .totalAmount(150000.0)
                .build();
        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-1")
                .transactionId("TX-1")
                .status("SUCCESS")
                .orderId(10L)
                .consumed(false)
                .build();
        when(orderRepository.findByIdWithLock(10L)).thenReturn(Optional.of(order));

        coordinator.fulfillOnSuccess(session);

        assertEquals(OrderStatus.COMPLETED, order.getStatus());
        assertEquals("TX-1", order.getPaymentTransactionId());
        assertTrue(session.isConsumed());
        verify(loyaltyService).awardOnCompletion(order, 150000.0);
        verify(orderRepository).save(order);
    }

    @Test
    void fulfillOnSuccess_activatesPendingSubscriptionAndCancelsOldActive() throws Exception {
        Store store = new Store();
        store.setId(5L);
        Subscription oldActive = Subscription.builder().id(1L).store(store).status(SubscriptionStatus.ACTIVE).build();
        Subscription newSub = Subscription.builder().id(2L).store(store).planId("7").status(SubscriptionStatus.PENDING).build();
        SubscriptionPlan plan = SubscriptionPlan.builder().id(7L).billingCycle("YEARLY").build();

        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-2")
                .transactionId("TX-SUB")
                .status("SUCCESS")
                .subscriptionId(2L)
                .consumed(false)
                .build();

        when(subscriptionRepository.findById(2L)).thenReturn(Optional.of(newSub));
        when(subscriptionPlanRepository.findById(7L)).thenReturn(Optional.of(plan));
        when(subscriptionRepository.findByStoreIdAndStatusIn(eq(5L), anyList())).thenReturn(List.of(oldActive));

        coordinator.fulfillOnSuccess(session);

        assertEquals(SubscriptionStatus.CANCELLED, oldActive.getStatus());
        assertEquals(SubscriptionStatus.ACTIVE, newSub.getStatus());
        assertEquals("TX-SUB", newSub.getTransactionId());
        assertNotNull(newSub.getEndDate());
        assertTrue(session.isConsumed());
        verify(planLimitChecker).assertCanSwitchTo(store, plan);
        verify(subscriptionRepository).save(oldActive);
        verify(subscriptionRepository).save(newSub);
    }
}
