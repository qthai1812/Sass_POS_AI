package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import com.zosh.modal.PasswordResetToken;
import com.zosh.modal.User;
import com.zosh.payload.response.ApiResponse;
import com.zosh.repository.PasswordResetTokenRepository;
import com.zosh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthRateLimiter rateLimiter;
    @Mock private PasswordPolicyService passwordPolicyService;
    @Mock private SendGridEmailService sendGridEmailService;

    @InjectMocks
    private PasswordResetService passwordResetService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setEmail("owner@pos.vn");
        user.setFullName("Owner");
        user.setPassword("$2a$oldHash");
    }

    @Test
    void forgotPassword_unknownEmail_returnsGenericMessageWithoutSendingEmail() throws Exception {
        when(userRepository.findByEmail("unknown@pos.vn")).thenReturn(null);

        ApiResponse res = passwordResetService.forgotPassword("unknown@pos.vn", "127.0.0.1");

        assertTrue(res.getMessage().contains("Nếu email tồn tại"));
        verify(sendGridEmailService, never()).sendOtpEmail(anyString(), any(), anyString());
    }

    @Test
    void forgotPassword_within60SecondResendCooldown_throwsUserException() throws Exception {
        PasswordResetToken recent = PasswordResetToken.builder()
                .createdAt(LocalDateTime.now().minusSeconds(20))
                .expiresAt(LocalDateTime.now().plusMinutes(4))
                .used(false)
                .build();
        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(user);
        when(passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(1L))
                .thenReturn(Optional.of(recent));

        UserException ex = assertThrows(UserException.class,
                () -> passwordResetService.forgotPassword("owner@pos.vn", "127.0.0.1"));
        assertTrue(ex.getMessage().contains("giây"));
        verify(sendGridEmailService, never()).sendOtpEmail(anyString(), any(), anyString());
    }

    @Test
    void forgotPassword_validUser_invalidatesOldAndSendsOtp() throws Exception {
        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(user);
        when(passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(1L))
                .thenReturn(Optional.empty());

        ApiResponse res = passwordResetService.forgotPassword("owner@pos.vn", "127.0.0.1");

        assertNotNull(res.getMessage());
        verify(passwordResetTokenRepository).invalidateAllActiveTokensByUserId(1L);
        verify(passwordResetTokenRepository).save(argThat(t ->
                t.getOtpCode() != null && t.getOtpCode().matches("\\d{6}") && !t.isUsed()));
        verify(sendGridEmailService).sendOtpEmail(eq("owner@pos.vn"), eq("Owner"), argThat(otp -> otp.length() == 6));
    }

    @Test
    void verifyResetOtp_wrongOtpIncrementsAttemptsAndLocksAfterFiveTries() throws Exception {
        PasswordResetToken token = PasswordResetToken.builder()
                .otpCode("111222")
                .user(user)
                .expiresAt(LocalDateTime.now().plusMinutes(3))
                .attemptCount(4)
                .otpVerified(false)
                .used(false)
                .build();
        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(user);
        when(passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(1L))
                .thenReturn(Optional.of(token));

        assertThrows(UserException.class,
                () -> passwordResetService.verifyResetOtp("owner@pos.vn", "999999", "127.0.0.1"));

        assertEquals(5, token.getAttemptCount());
        assertTrue(token.isUsed());
        verify(passwordResetTokenRepository).save(token);
        verify(rateLimiter).checkAndRecord("IP:127.0.0.1", true);
    }

    @Test
    void verifyResetOtp_validOtp_issuesResetTicket() throws Exception {
        PasswordResetToken token = PasswordResetToken.builder()
                .otpCode("123456")
                .user(user)
                .expiresAt(LocalDateTime.now().plusMinutes(3))
                .attemptCount(0)
                .otpVerified(false)
                .used(false)
                .build();
        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(user);
        when(passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(1L))
                .thenReturn(Optional.of(token));

        Map<String, Object> result = passwordResetService.verifyResetOtp("owner@pos.vn", "123456", "127.0.0.1");

        assertTrue(token.isOtpVerified());
        assertNotNull(result.get("resetTicket"));
        assertEquals(300, result.get("expiresInSeconds"));
    }

    @Test
    void resetPassword_validTicket_updatesPasswordAndMarksUsed() throws Exception {
        PasswordResetToken token = PasswordResetToken.builder()
                .resetTicket("ticket-abc")
                .user(user)
                .expiresAt(LocalDateTime.now().plusMinutes(3))
                .otpVerified(true)
                .used(false)
                .build();
        when(passwordResetTokenRepository.findByResetTicket("ticket-abc")).thenReturn(Optional.of(token));
        when(passwordEncoder.matches("newPass123", "$2a$oldHash")).thenReturn(false);
        when(passwordEncoder.encode("newPass123")).thenReturn("$2a$newHash");

        ApiResponse res = passwordResetService.resetPassword("ticket-abc", "newPass123", "newPass123", "127.0.0.1");

        assertTrue(res.getMessage().contains("thành công"));
        assertTrue(token.isUsed());
        verify(passwordPolicyService).enforceChangeLimits(user);
        verify(passwordPolicyService).applyPasswordUpdate(user, "$2a$newHash");
        verify(userRepository).save(user);
        verify(passwordResetTokenRepository).save(token);
    }
}
