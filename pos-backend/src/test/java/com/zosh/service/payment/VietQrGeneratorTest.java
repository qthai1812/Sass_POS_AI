package com.zosh.service.payment;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VietQrGeneratorTest {

    private final VietQrGenerator generator = new VietQrGenerator();

    @Test
    void resolveBankBin_mapsVietnameseBanksAndDefaultsToMbBank() {
        assertEquals("970436", generator.resolveBankBin("Vietcombank"));
        assertEquals("970407", generator.resolveBankBin("TCB"));
        assertEquals("970418", generator.resolveBankBin("BIDV"));
        assertEquals("970422", generator.resolveBankBin(null));
        assertEquals("970422", generator.resolveBankBin("Unknown Bank"));
    }

    @Test
    void buildVietQrImageUrl_containsBankBinAccountAmountAndEncodedInfo() {
        String url = generator.buildVietQrImageUrl("970436", "0123456789", 250000L, "POS123456", "Zosh Store", "NGUYEN VAN A");

        assertTrue(url.startsWith("https://img.vietqr.io/image/970436-0123456789-compact2.png"));
        assertTrue(url.contains("amount=250000"));
        assertTrue(url.contains("POS123456"));
        assertTrue(url.contains("NGUYEN+VAN+A"));
    }

    @Test
    void generateTokensAndIds_followExpectedFormat() {
        assertTrue(generator.generateSessionId().startsWith("PAY-"));
        assertTrue(generator.generateReferenceCode().matches("^POS\\d{6}$"));
        assertEquals(64, generator.generateWebhookToken().length());
    }
}
