package com.zosh.service.payment;

import com.zosh.service.PaymentGatewayService.CardAuthorizeRequest;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CardPaymentValidatorTest {

    private final CardPaymentValidator validator = new CardPaymentValidator();

    @Test
    void processAuthorization_rejectsCvv000AndInvalidInputs() {
        PaymentSessionDTO session = PaymentSessionDTO.builder().sessionId("PAY-1").status("PENDING").build();

        assertFalse(validator.processAuthorization(session, new CardAuthorizeRequest("1234", "12/29", "123", "AN")));
        assertEquals("FAILED", session.getStatus());

        assertFalse(validator.processAuthorization(session, new CardAuthorizeRequest("4221567890123456", "01/20", "123", "NGUYEN AN")));
        assertTrue(session.getProviderMessage().contains("hết hạn"));

        assertFalse(validator.processAuthorization(session, new CardAuthorizeRequest("4221567890123456", "12/30", "000", "NGUYEN AN")));
        assertTrue(session.getProviderMessage().contains("DO_NOT_HONOR"));
    }

    @Test
    void processAuthorization_approvesValidVisaCardAndMasksNumber() {
        PaymentSessionDTO session = PaymentSessionDTO.builder().sessionId("PAY-1").status("PENDING").build();

        boolean approved = validator.processAuthorization(
                session, new CardAuthorizeRequest("4221 5678 9012 3456", "12/30", "456", "NGUYEN VAN A"));

        assertTrue(approved);
        assertEquals("SUCCESS", session.getStatus());
        assertEquals("Visa", session.getCardBrand());
        assertEquals("•••• •••• •••• 3456", session.getMaskedCardNumber());
        assertNotNull(session.getTransactionId());
        assertTrue(session.getTransactionId().startsWith("VISA-3DS-"));
        assertNotNull(session.getPaidAt());
    }

    @Test
    void detectCardBrand_identifiesMajorBrands() {
        assertEquals("Visa", validator.detectCardBrand("4111111111111111"));
        assertEquals("Mastercard", validator.detectCardBrand("5200000000000000"));
        assertEquals("JCB", validator.detectCardBrand("3528000000000000"));
        assertEquals("Napas", validator.detectCardBrand("9704220000000000"));
    }
}
