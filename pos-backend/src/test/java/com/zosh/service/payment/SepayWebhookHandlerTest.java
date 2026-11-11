package com.zosh.service.payment;

import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.PaymentGatewayService.SepayWebhookPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SepayWebhookHandlerTest {

    @Mock private PaymentSessionStore sessionStore;
    @Mock private PaymentFulfillmentCoordinator fulfillmentCoordinator;

    @InjectMocks
    private SepayWebhookHandler handler;

    @BeforeEach
    void setUp() {
        handler.setSepayApiKeyForTest("secret-sepay-key-123");
    }

    @Test
    void handle_unconfiguredOrWrongApiKey_throwsAccessDenied() {
        SepayWebhookPayload payload = new SepayWebhookPayload();
        payload.setTransferType("in");

        assertThrows(AccessDeniedException.class,
                () -> handler.handle("Apikey wrong-key", payload));

        handler.setSepayApiKeyForTest("");
        assertThrows(AccessDeniedException.class,
                () -> handler.handle("Apikey secret-sepay-key-123", payload));
    }

    @Test
    void handle_outgoingOrDuplicateTransaction_returnsNullWithoutFulfillment() {
        SepayWebhookPayload outPayload = new SepayWebhookPayload();
        outPayload.setTransferType("out");
        assertNull(handler.handle("Apikey secret-sepay-key-123", outPayload));

        SepayWebhookPayload dupPayload = new SepayWebhookPayload();
        dupPayload.setId(999L);
        dupPayload.setTransferType("in");
        when(sessionStore.existsByProviderTxId("SEPAY-999")).thenReturn(true);

        assertNull(handler.handle("Apikey secret-sepay-key-123", dupPayload));
        verify(fulfillmentCoordinator, never()).fulfillOnSuccess(any());
    }

    @Test
    void handle_underpaidTransfer_keepsPendingAndUpdatesMessage() {
        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-1")
                .referenceCode("POS123456")
                .amount(150000.0)
                .status("PENDING")
                .consumed(false)
                .build();

        SepayWebhookPayload payload = new SepayWebhookPayload();
        payload.setId(100L);
        payload.setTransferType("in");
        payload.setTransferAmount(100000.0);
        payload.setContent("Chuyen tien POS123456");

        when(sessionStore.existsByProviderTxId("SEPAY-100")).thenReturn(false);
        when(sessionStore.findPendingSessionForSepay(any(), anyString(), any())).thenReturn(session);

        PaymentSessionDTO res = handler.handle("Apikey secret-sepay-key-123", payload);

        assertEquals("PENDING", res.getStatus());
        assertTrue(res.getProviderMessage().contains("thiếu tiền"));
        verify(fulfillmentCoordinator, never()).fulfillOnSuccess(any());
        verify(sessionStore).syncSessionToDb(session);
    }

    @Test
    void handle_fullTransfer_marksSuccessAndTriggersFulfillment() {
        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("PAY-2")
                .referenceCode("POS654321")
                .amount(200000.0)
                .status("PENDING")
                .consumed(false)
                .build();

        SepayWebhookPayload payload = new SepayWebhookPayload();
        payload.setId(202L);
        payload.setGateway("MBBank");
        payload.setTransferType("in");
        payload.setTransferAmount(200000.0);
        payload.setContent("POS654321 thanh toan");

        when(sessionStore.existsByProviderTxId("SEPAY-202")).thenReturn(false);
        when(sessionStore.findPendingSessionForSepay(any(), anyString(), any())).thenReturn(session);

        PaymentSessionDTO res = handler.handle("Apikey secret-sepay-key-123", payload);

        assertEquals("SUCCESS", res.getStatus());
        assertEquals("SEPAY-202", res.getProviderTxId());
        assertNotNull(res.getPaidAt());
        verify(fulfillmentCoordinator).fulfillOnSuccess(session);
        verify(sessionStore).syncSessionToDb(session);
    }

    @Test
    void matchesSepayReference_respectsWordBoundaries() {
        assertTrue(handler.matchesSepayReference("POS123456", "", "CK POS123456 Thanh toan", ""));
        assertFalse(handler.matchesSepayReference("POS123", "", "CK POS123456 Thanh toan", ""));
    }
}
