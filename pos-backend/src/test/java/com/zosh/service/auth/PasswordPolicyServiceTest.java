package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import com.zosh.modal.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyServiceTest {

    private final PasswordPolicyService policyService = new PasswordPolicyService();

    @Test
    void enforceChangeLimits_rejectsWithinFiveMinuteCooldown() {
        User user = new User();
        user.setPasswordChangedAt(LocalDateTime.now().minusMinutes(2));

        UserException ex = assertThrows(UserException.class, () -> policyService.enforceChangeLimits(user));
        assertTrue(ex.getMessage().contains("5 phút"));
    }

    @Test
    void enforceChangeLimits_rejectsAfterThreeDailyChanges() {
        User user = new User();
        user.setPasswordChangedAt(LocalDateTime.now().minusMinutes(10));
        user.setPasswordChangeCountDate(LocalDate.now());
        user.setDailyPasswordChangeCount(3);

        UserException ex = assertThrows(UserException.class, () -> policyService.enforceChangeLimits(user));
        assertTrue(ex.getMessage().contains("3 lần"));
    }

    @Test
    void enforceChangeLimits_allowsWhenPreviousChangesWereYesterday() {
        User user = new User();
        user.setPasswordChangedAt(LocalDateTime.now().minusHours(24));
        user.setPasswordChangeCountDate(LocalDate.now().minusDays(1));
        user.setDailyPasswordChangeCount(3);

        assertDoesNotThrow(() -> policyService.enforceChangeLimits(user));
    }

    @Test
    void applyPasswordUpdate_incrementsDailyCountAndSetsTimestamp() {
        User user = new User();
        user.setPasswordChangeCountDate(LocalDate.now());
        user.setDailyPasswordChangeCount(1);

        policyService.applyPasswordUpdate(user, "$2a$encoded");

        assertEquals("$2a$encoded", user.getPassword());
        assertEquals(2, user.getDailyPasswordChangeCount());
        assertEquals(LocalDate.now(), user.getPasswordChangeCountDate());
        assertNotNull(user.getPasswordChangedAt());
    }
}
