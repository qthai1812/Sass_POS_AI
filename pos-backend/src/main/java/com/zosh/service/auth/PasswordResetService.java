package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import com.zosh.modal.PasswordResetToken;
import com.zosh.modal.User;
import com.zosh.payload.response.ApiResponse;
import com.zosh.repository.PasswordResetTokenRepository;
import com.zosh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Điều phối quy trình khôi phục mật khẩu 3 bước (OTP 6 số -> Reset Ticket -> Đặt mật khẩu mới).
 */
@Component
@RequiredArgsConstructor
public class PasswordResetService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final int RESET_TICKET_EXPIRY_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final int OTP_RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthRateLimiter rateLimiter;
    private final PasswordPolicyService passwordPolicyService;
    private final SendGridEmailService sendGridEmailService;

    @Transactional(rollbackFor = Exception.class)
    public ApiResponse forgotPassword(String emailInput, String clientIp) throws Exception {
        if (emailInput == null || emailInput.trim().isEmpty()) {
            throw new UserException("Vui lòng nhập địa chỉ email hoặc tên đăng nhập.");
        }
        String cleanEmail = emailInput.trim().toLowerCase();

        rateLimiter.checkAndRecord("IP:" + clientIp, false);
        sendGridEmailService.assertConfigured();

        final String genericSafeMessage = "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được gửi";
        User user = userRepository.findByEmail(cleanEmail);
        if (user == null) {
            ApiResponse response = new ApiResponse();
            response.setMessage(genericSafeMessage);
            return response;
        }

        passwordPolicyService.enforceChangeLimits(user);
        assertOtpResendCooldown(user.getId());
        rateLimiter.checkAndRecord("EMAIL:" + cleanEmail, false);

        passwordResetTokenRepository.invalidateAllActiveTokensByUserId(user.getId());

        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token(UUID.randomUUID().toString())
                .otpCode(otpCode)
                .user(user)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .otpVerified(false)
                .used(false)
                .attemptCount(0)
                .requestIp(clientIp)
                .build();
        passwordResetTokenRepository.save(resetToken);

        sendGridEmailService.sendOtpEmail(user.getEmail(), user.getFullName(), otpCode);

        ApiResponse response = new ApiResponse();
        response.setMessage(genericSafeMessage);
        return response;
    }

    @Transactional(rollbackFor = Exception.class, noRollbackFor = UserException.class)
    public Map<String, Object> verifyResetOtp(String emailInput, String otpInput, String clientIp) throws Exception {
        if (emailInput == null || emailInput.isBlank() || otpInput == null || otpInput.isBlank()) {
            throw new UserException("Vui lòng nhập đầy đủ email và mã OTP 6 chữ số.");
        }
        String cleanEmail = emailInput.trim().toLowerCase();
        String cleanOtp = otpInput.trim();

        rateLimiter.checkAndRecord("IP:" + clientIp, false);

        User user = userRepository.findByEmail(cleanEmail);
        if (user == null) {
            rateLimiter.checkAndRecord("IP:" + clientIp, true);
            throw new UserException("Mã OTP không chính xác hoặc đã hết hạn.");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new UserException("Không tìm thấy yêu cầu khôi phục mật khẩu hợp lệ hoặc mã đã được sử dụng."));

        validateOtpTokenState(resetToken);
        verifyOtpCodeMatch(resetToken, cleanOtp, clientIp);

        String resetTicket = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        resetToken.setOtpVerified(true);
        resetToken.setResetTicket(resetTicket);
        resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(RESET_TICKET_EXPIRY_MINUTES));
        passwordResetTokenRepository.save(resetToken);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Xác thực OTP thành công. Vui lòng thiết lập mật khẩu mới.");
        result.put("resetTicket", resetTicket);
        result.put("expiresInSeconds", RESET_TICKET_EXPIRY_MINUTES * 60);
        return result;
    }

    @Transactional(rollbackFor = Exception.class, noRollbackFor = UserException.class)
    public ApiResponse resetPassword(String resetTicket, String newPassword, String confirmPassword, String clientIp) throws Exception {
        validateResetPasswordInputs(resetTicket, newPassword, confirmPassword);

        PasswordResetToken resetToken = passwordResetTokenRepository.findByResetTicket(resetTicket.trim())
                .orElseGet(() -> passwordResetTokenRepository.findByToken(resetTicket.trim()).orElse(null));

        if (resetToken == null || !resetToken.isOtpVerified()) {
            rateLimiter.checkAndRecord("IP:" + clientIp, true);
            throw new UserException("Phiên khôi phục mật khẩu không hợp lệ hoặc chưa xác thực OTP.");
        }
        if (resetToken.isUsed()) {
            throw new UserException("Phiên đặt lại mật khẩu này đã được sử dụng trước đó.");
        }
        if (resetToken.isExpired()) {
            resetToken.setUsed(true);
            passwordResetTokenRepository.save(resetToken);
            throw new UserException("Phiên đặt lại mật khẩu đã hết hạn (5 phút). Vui lòng thực hiện lại.");
        }

        User user = resetToken.getUser();
        passwordPolicyService.enforceChangeLimits(user);

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new UserException("Mật khẩu mới không được trùng với mật khẩu đang sử dụng.");
        }

        passwordPolicyService.applyPasswordUpdate(user, passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        ApiResponse response = new ApiResponse();
        response.setMessage("Đổi mật khẩu thành công! Toàn bộ các phiên đăng nhập cũ đã được đăng xuất để bảo vệ an toàn.");
        return response;
    }

    private void assertOtpResendCooldown(Long userId) throws UserException {
        Optional<PasswordResetToken> latestActiveToken =
                passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(userId);
        if (latestActiveToken.isEmpty()) {
            return;
        }
        PasswordResetToken existing = latestActiveToken.get();
        if (!existing.isExpired() && existing.getCreatedAt() != null) {
            long secondsElapsed = Duration.between(existing.getCreatedAt(), LocalDateTime.now()).getSeconds();
            if (secondsElapsed < OTP_RESEND_COOLDOWN_SECONDS) {
                throw new UserException("Vui lòng đợi " + (OTP_RESEND_COOLDOWN_SECONDS - secondsElapsed)
                        + " giây trước khi yêu cầu gửi lại mã OTP mới.");
            }
        }
    }

    private void validateOtpTokenState(PasswordResetToken resetToken) throws UserException {
        if (resetToken.isUsed() || resetToken.isOtpVerified()) {
            throw new UserException("Mã OTP này đã được sử dụng trước đó (Replay Attack Blocked). Vui lòng yêu cầu mã mới.");
        }
        if (resetToken.isExpired()) {
            resetToken.setUsed(true);
            passwordResetTokenRepository.save(resetToken);
            throw new UserException("Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới.");
        }
        if (resetToken.getAttemptCount() >= MAX_OTP_ATTEMPTS) {
            resetToken.setUsed(true);
            passwordResetTokenRepository.save(resetToken);
            throw new UserException("Bạn đã nhập sai mã OTP quá 5 lần. Mã này đã bị hủy để bảo vệ tài khoản.");
        }
    }

    private void verifyOtpCodeMatch(PasswordResetToken resetToken, String cleanOtp, String clientIp) throws UserException {
        if (cleanOtp.equals(resetToken.getOtpCode())) {
            return;
        }
        resetToken.setAttemptCount(resetToken.getAttemptCount() + 1);
        int remaining = MAX_OTP_ATTEMPTS - resetToken.getAttemptCount();
        if (remaining <= 0) {
            resetToken.setUsed(true);
        }
        passwordResetTokenRepository.save(resetToken);
        rateLimiter.checkAndRecord("IP:" + clientIp, true);
        throw new UserException(remaining > 0
                ? ("Mã OTP không chính xác. Bạn còn " + remaining + " lần thử.")
                : "Bạn đã nhập sai quá số lần quy định. Vui lòng lấy mã OTP mới.");
    }

    private void validateResetPasswordInputs(String resetTicket, String newPassword, String confirmPassword) throws UserException {
        if (resetTicket == null || resetTicket.trim().isEmpty()) {
            throw new UserException("Phiên đặt lại mật khẩu (Reset Ticket) không hợp lệ.");
        }
        if (newPassword == null || newPassword.trim().length() < PasswordPolicyService.MIN_PASSWORD_LENGTH) {
            throw new UserException("Mật khẩu mới phải có ít nhất 6 ký tự.");
        }
        if (confirmPassword != null && !newPassword.equals(confirmPassword)) {
            throw new UserException("Mật khẩu xác nhận không khớp với mật khẩu mới.");
        }
    }
}
