package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.PaymentGatewayService.*;
import com.zosh.service.UserService;
import com.zosh.service.payment.*;
import com.zosh.service.payment.PlatformPaymentConfigService.RecipientDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentGatewayServiceImplTest {

    @Mock private StoreRepository storeRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private SubscriptionPlanRepository subscriptionPlanRepository;
    @Mock private AccessControlService accessControl;
    @Mock private UserService userService;
    @Mock private PaymentEnvironmentPolicy environmentPolicy;
    @Mock private VietQrGenerator vietQrGenerator;
    @Mock private PlatformPaymentConfigService platformConfigService;
    @Mock private PaymentSessionStore sessionStore;
    @Mock private CardPaymentValidator cardPaymentValidator;
    @Mock private PaymentFulfillmentCoordinator fulfillmentCoordinator;
    @Mock private SepayWebhookHandler sepayWebhookHandler;

    @InjectMocks
    private PaymentGatewayServiceImpl service;

    private User cashier;
    private Store store;
    private Branch branch;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Fashion Store");
        branch = Branch.builder().id(10L).store(store).build();
        cashier = new User();
        cashier.setId(100L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setStore(store);
        cashier.setBranch(branch);
    }

    @Test
    void createSession_forPendingOrder_linksSessionToOrderAndHidesTokenInProd() throws Exception {
        Order order = Order.builder().id(50L).branch(branch).status(OrderStatus.PENDING).totalAmount(250000.0).build();
        CreateSessionRequest req = new CreateSessionRequest();
        req.setOrderId(50L);
        req.setMethod("MOMO");

        when(userService.getCurrentUserAllowingBlockedStore()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(50L)).thenReturn(Optional.of(order));
        when(accessControl.canAccessBranch(cashier, branch)).thenReturn(true);
        when(platformConfigService.resolveRecipientDetails(1L, cashier))
                .thenReturn(new RecipientDetails("Fashion Store", "0901234567", "FASHION", "VCB", "0123456789"));
        when(vietQrGenerator.generateSessionId()).thenReturn("PAY-12345678");
        when(vietQrGenerator.generateReferenceCode()).thenReturn("POS112233");
        when(vietQrGenerator.generateWebhookToken()).thenReturn("secret-token");
        when(vietQrGenerator.resolveBankBin("VCB")).thenReturn("970436");
        when(vietQrGenerator.buildVietQrImageUrl(any(), any(), eq(250000L), eq("POS112233"), any(), any()))
                .thenReturn("https://img.vietqr.io/qr.png");
        when(environmentPolicy.resolveBackendBaseUrl()).thenReturn("https://pos.example.com");
        when(vietQrGenerator.buildMobileCheckoutUrl("https://pos.example.com", "PAY-12345678"))
                .thenReturn("https://pos.example.com/checkout/PAY-12345678");
        when(vietQrGenerator.buildQrServerImageUrl(anyString())).thenReturn("https://qrserver/img.png");
        when(environmentPolicy.isSimulationAllowed()).thenReturn(false);

        PaymentSessionDTO result = service.createSession(req);

        assertEquals("PAY-12345678", result.getSessionId());
        assertEquals(250000.0, result.getAmount());
        assertNull(result.getWebhookToken()); // Sanitized when simulation disabled
        assertEquals("PAY-12345678", order.getPaymentSessionId());
        verify(sessionStore).saveNewSession(any(PaymentSessionDTO.class));
        verify(orderRepository).save(order);
    }

    @Test
    void processWebhook_blocksWhenSimulationDisabledOrSignatureInvalid() {
        when(environmentPolicy.isSimulationAllowed()).thenReturn(false);
        assertThrows(AccessDeniedException.class,
                () -> service.processWebhook("PAY-1", "sig", new WebhookRequest()));

        when(environmentPolicy.isSimulationAllowed()).thenReturn(true);
        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-1")
                .webhookToken("expected-sig")
                .status("PENDING")
                .amount(100000.0)
                .build();
        when(sessionStore.findAndLockSession("PAY-1")).thenReturn(session);

        assertThrows(AccessDeniedException.class,
                () -> service.processWebhook("PAY-1", "wrong-sig", new WebhookRequest()));
    }

    @Test
    void processWebhook_validSignature_completesAndTriggersFulfillment() {
        when(environmentPolicy.isSimulationAllowed()).thenReturn(true);
        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-1")
                .webhookToken("expected-sig")
                .status("PENDING")
                .amount(100000.0)
                .build();
        when(sessionStore.findAndLockSession("PAY-1")).thenReturn(session);

        WebhookRequest req = new WebhookRequest();
        req.setStatus("SUCCESS");
        PaymentSessionDTO result = service.processWebhook("PAY-1", "expected-sig", req);

        assertEquals("SUCCESS", result.getStatus());
        assertNull(result.getWebhookToken());
        verify(fulfillmentCoordinator).fulfillOnSuccess(session);
        verify(sessionStore).syncSessionToDb(session);
    }

    @Test
    void verifyAndConsumePosOrderPayment_allowsIdempotentForSameOrderAndBlocksOtherOrder() {
        PaymentSessionDTO consumed = PaymentSessionDTO.builder()
                .sessionId("PAY-1")
                .storeId(1L)
                .orderId(50L)
                .amount(100000.0)
                .status("SUCCESS")
                .consumed(true)
                .build();
        when(sessionStore.findAndLockByTxOrSessionId("PAY-1")).thenReturn(consumed);

        PaymentSessionDTO sameOrder = service.verifyAndConsumePosOrderPayment("PAY-1", 1L, 100000.0, 50L);
        assertEquals("PAY-1", sameOrder.getSessionId());

        assertThrows(AccessDeniedException.class,
                () -> service.verifyAndConsumePosOrderPayment("PAY-1", 1L, 100000.0, 99L));
    }

    @Test
    void verifyAndConsumeSubscriptionPayment_rejectsPosStoreSessionAndMarksConsumed() {
        PaymentSessionDTO posSession = PaymentSessionDTO.builder()
                .sessionId("PAY-POS")
                .storeId(1L)
                .amount(299000.0)
                .status("SUCCESS")
                .consumed(false)
                .build();
        when(sessionStore.findAndLockByTxOrSessionId("PAY-POS")).thenReturn(posSession);
        assertThrows(AccessDeniedException.class,
                () -> service.verifyAndConsumeSubscriptionPayment("PAY-POS", 299000.0));

        PaymentSessionDTO subSession = PaymentSessionDTO.builder()
                .sessionId("PAY-SUB")
                .storeId(null)
                .amount(299000.0)
                .status("SUCCESS")
                .consumed(false)
                .build();
        when(sessionStore.findAndLockByTxOrSessionId("PAY-SUB")).thenReturn(subSession);

        service.verifyAndConsumeSubscriptionPayment("PAY-SUB", 299000.0);
        assertTrue(subSession.isConsumed());
        verify(sessionStore).syncSessionToDb(subSession);
    }
}
