package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimiterTest {

    @Test
    void checkAndRecord_blocksAfterFiveFailedAttempts() throws UserException {
        AuthRateLimiter limiter = new AuthRateLimiter();
        for (int i = 0; i < 4; i++) {
            limiter.checkAndRecord("IP:1.2.3.4", true);
        }
        UserException ex = assertThrows(UserException.class,
                () -> limiter.checkAndRecord("IP:1.2.3.4", true));
        assertTrue(ex.getMessage().contains("15 phút"));

        // Subsequent request while blocked also throws
        assertThrows(UserException.class, () -> limiter.checkAndRecord("IP:1.2.3.4", false));
    }

    @Test
    void checkAndRecord_blocksAfterTenRequestsEvenWithoutFailures() throws UserException {
        AuthRateLimiter limiter = new AuthRateLimiter();
        for (int i = 0; i < 10; i++) {
            limiter.checkAndRecord("EMAIL:test@pos.vn", false);
        }
        assertThrows(UserException.class, () -> limiter.checkAndRecord("EMAIL:test@pos.vn", false));
    }

    @Test
    void checkAndRecord_ignoresBlankKey() {
        AuthRateLimiter limiter = new AuthRateLimiter();
        assertDoesNotThrow(() -> limiter.checkAndRecord(null, true));
        assertDoesNotThrow(() -> limiter.checkAndRecord("   ", true));
    }
}
