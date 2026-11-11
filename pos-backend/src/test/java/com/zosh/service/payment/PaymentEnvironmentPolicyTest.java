package com.zosh.service.payment;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PaymentEnvironmentPolicyTest {

    @Test
    void isSimulationAllowed_disabledInProdOrPublicDomains() {
        assertFalse(new PaymentEnvironmentPolicy(5000, "", "http://localhost:5173", "prod", true).isSimulationAllowed());
        assertFalse(new PaymentEnvironmentPolicy(5000, "https://api.myshop.vn", "http://localhost:5173", "dev", true).isSimulationAllowed());
        assertFalse(new PaymentEnvironmentPolicy(5000, "", "https://app.myshop.vn", "dev", true).isSimulationAllowed());
    }

    @Test
    void isSimulationAllowed_enabledInLocalDevEnvironment() {
        assertTrue(new PaymentEnvironmentPolicy(5000, "", "http://localhost:5173", "dev", false).isSimulationAllowed());
        assertTrue(new PaymentEnvironmentPolicy(5000, "http://127.0.0.1:5000", "http://localhost:5173", "local", false).isSimulationAllowed());
    }

    @Test
    void resolveBackendBaseUrl_stripsTrailingSlashesFromPublicUrl() {
        PaymentEnvironmentPolicy policy = new PaymentEnvironmentPolicy(5000, "https://pos.example.com///", "", "prod", false);
        assertEquals("https://pos.example.com", policy.resolveBackendBaseUrl());
    }
}
