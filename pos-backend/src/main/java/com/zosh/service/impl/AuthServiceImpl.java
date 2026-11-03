package com.zosh.service.impl;

import com.zosh.configuration.JwtProvider;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.PasswordResetToken;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.AuthResponse;
import com.zosh.repository.PasswordResetTokenRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final CustomUserImplementation customUserImplementation;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    // Đọc trực tiếp SendGrid API Key (SG.xxx) từ biến MAIL_PASSWORD hiện có
    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${app.mail.from:no-reply@pospro.com}")
    private String mailFrom;

    @Value("${app.mail.from-name:POS Pro Security}")
    private String mailFromName;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final int RESET_TICKET_EXPIRY_MINUTES = 5;
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final int PASSWORD_CHANGE_COOLDOWN_MINUTES = 5;
    private static final int MAX_DAILY_PASSWORD_CHANGES = 3;

    // Chống hành vi đáng ngờ (Rate Limit & Temporary Lockout theo IP / Email)
    private final Map<String, SuspiciousActivityTracker> securityTrackers = new ConcurrentHashMap<>();

    private static class SuspiciousActivityTracker {
        int requestCount = 0;
        int failedAttempts = 0;
        LocalDateTime windowStart = LocalDateTime.now();
        LocalDateTime blockedUntil = null;
    }

    private void checkAndRecordSuspiciousBehavior(String key, boolean isFailure) throws UserException {
        if (key == null || key.isBlank()) return;
        LocalDateTime now = LocalDateTime.now();
        SuspiciousActivityTracker tracker = securityTrackers.computeIfAbsent(key, k -> new SuspiciousActivityTracker());

        synchronized (tracker) {
            if (tracker.blockedUntil != null && now.isBefore(tracker.blockedUntil)) {
                long waitSeconds = Duration.between(now, tracker.blockedUntil).getSeconds();
                throw new UserException("Phát hiện hành vi đáng ngờ hoặc quá nhiều yêu cầu liên tiếp. Vui lòng thử lại sau "
                        + Math.max(1, (waitSeconds + 59) / 60) + " phút.");
            }
            if (Duration.between(tracker.windowStart, now).toMinutes() >= 15) {
                tracker.windowStart = now;
                tracker.requestCount = 0;
                tracker.failedAttempts = 0;
                tracker.blockedUntil = null;
            }
            tracker.requestCount++;
            if (isFailure) {
                tracker.failedAttempts++;
            }
            if (tracker.requestCount > 10 || tracker.failedAttempts >= MAX_OTP_ATTEMPTS) {
                tracker.blockedUntil = now.plusMinutes(15);
                throw new UserException("Tài khoản/IP của bạn tạm thời bị chặn 15 phút do có quá nhiều thao tác bất thường.");
            }
        }
    }

    private void enforcePasswordChangeLimits(User user) throws UserException {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();

        if (user.getPasswordChangedAt() != null) {
            long secondsSinceLastChange = Duration.between(user.getPasswordChangedAt(), now).getSeconds();
            long requiredSeconds = PASSWORD_CHANGE_COOLDOWN_MINUTES * 60L;
            if (secondsSinceLastChange < requiredSeconds) {
                long remainingSeconds = requiredSeconds - secondsSinceLastChange;
                long mins = remainingSeconds / 60;
                long secs = remainingSeconds % 60;
                throw new UserException(String.format(
                        "Bạn vừa đổi mật khẩu gần đây. Vui lòng đợi %d phút %d giây nữa mới được đổi mật khẩu tiếp (tối thiểu 5 phút/lần).",
                        mins, secs
                ));
            }
        }

        int countToday = 0;
        if (today.equals(user.getPasswordChangeCountDate()) && user.getDailyPasswordChangeCount() != null) {
            countToday = user.getDailyPasswordChangeCount();
        }
        if (countToday >= MAX_DAILY_PASSWORD_CHANGES) {
            throw new UserException("Bạn đã đạt giới hạn đổi mật khẩu tối đa 3 lần trong ngày hôm nay. Vui lòng thử lại vào ngày mai.");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse signup(UserDto userDto) throws UserException {
        if (userDto == null || userDto.getEmail() == null || userDto.getEmail().trim().isEmpty()) {
            throw new UserException("Email is required");
        }
        if (userDto.getPassword() == null || userDto.getPassword().trim().length() < 6) {
            throw new UserException("Password must be at least 6 characters");
        }
        if (userDto.getFullName() == null || userDto.getFullName().trim().isEmpty()) {
            throw new UserException("Full name is required");
        }

        User user = userRepository.findByEmail(userDto.getEmail().trim());
        if (user != null) {
            throw new UserException("email id already registered");
        }

        UserRole assignedRole = userDto.getRole() != null ? userDto.getRole() : UserRole.ROLE_STORE_ADMIN;
        if (assignedRole != UserRole.ROLE_STORE_ADMIN) {
            throw new UserException("Public registration is only allowed for ROLE_STORE_ADMIN");
        }

        User newUser = new User();
        newUser.setEmail(userDto.getEmail().trim());
        newUser.setPassword(passwordEncoder.encode(userDto.getPassword()));
        newUser.setRole(assignedRole);
        newUser.setFullName(userDto.getFullName().trim());
        newUser.setPhone(userDto.getPhone());
        newUser.setLastLogin(LocalDateTime.now());
        newUser.setCreatedAt(LocalDateTime.now());

        User savedUser = userRepository.save(newUser);

        UserDetails userDetails = customUserImplementation.loadUserByUsername(savedUser.getEmail());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);

        String jwt = jwtProvider.generateToken(authentication);

        AuthResponse authResponse = new AuthResponse();
        authResponse.setJwt(jwt);
        authResponse.setMessage("Registered Successfully");
        authResponse.setUser(UserMapper.toDTO(savedUser));

        return authResponse;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse login(UserDto userDto) throws UserException {
        if (userDto == null || userDto.getEmail() == null || userDto.getPassword() == null) {
            throw new UserException("Email and password are required");
        }
        String email = userDto.getEmail().trim();
        String password = userDto.getPassword();
        Authentication authentication = authenticate(email, password);
        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByEmail(email);
        if (user != null && Boolean.FALSE.equals(user.getLoginAccess())) {
            SecurityContextHolder.clearContext();
            throw new UserException("Login access for this account has been disabled by your manager.");
        }
        Store effectiveStore = null;
        if (user != null && user.getRole() != UserRole.ROLE_ADMIN) {
            effectiveStore = user.getStore();
            if (effectiveStore == null && user.getBranch() != null) {
                effectiveStore = user.getBranch().getStore();
            }
            if (effectiveStore == null) {
                effectiveStore = storeRepository.findByStoreAdminId(user.getId());
            }

            if ((user.getRole() == UserRole.ROLE_BRANCH_CASHIER || user.getRole() == UserRole.ROLE_BRANCH_MANAGER)
                    && (user.getBranch() == null || effectiveStore == null)) {
                SecurityContextHolder.clearContext();
                throw new UserException("Your account is not assigned to an active branch or store. Please contact your Store Admin.");
            }
            if (user.getRole() == UserRole.ROLE_STORE_MANAGER && effectiveStore == null) {
                SecurityContextHolder.clearContext();
                throw new UserException("Your account is no longer assigned to an active store. Please contact your Store Admin.");
            }

            if (effectiveStore != null && effectiveStore.getStatus() == StoreStatus.BLOCKED) {
                SecurityContextHolder.clearContext();
                throw new UserException(
                        "Store \"" + effectiveStore.getBrand() + "\" has been BLOCKED by Super Admin. Access is suspended for all accounts in this store."
                );
            }
        }

        String jwt = jwtProvider.generateToken(authentication);
        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        AuthResponse authResponse = new AuthResponse();
        authResponse.setJwt(jwt);
        authResponse.setMessage("Login Successfully");
        authResponse.setUser(UserMapper.toDTO(user, effectiveStore));

        return authResponse;
    }

    /**
     * Gửi email qua SendGrid Web API v3 (HTTPS cổng 443) - Không bị Render gói Free chặn.
     */
    private void sendEmailViaSendGridApi(String toEmail, String subject, String htmlContent) throws UserException {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(10000);
        RestTemplate restTemplate = new RestTemplate(factory);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(mailPassword.trim());

        Map<String, Object> payload = Map.of(
                "personalizations", List.of(
                        Map.of(
                                "to", List.of(Map.of("email", toEmail.trim())),
                                "subject", subject
                        )
                ),
                "from", Map.of(
                        "email", mailFrom.trim(),
                        "name", mailFromName != null ? mailFromName.trim() : "POS Pro Security"
                ),
                "content", List.of(
                        Map.of(
                                "type", "text/html",
                                "value", htmlContent
                        )
                )
        );

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(SENDGRID_API_URL, requestEntity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new UserException("SendGrid Web API trả về mã lỗi: " + response.getStatusCode());
            }
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            String body = e.getResponseBodyAsString();
            log.error("SendGrid Web API HTTP error {} while sending OTP to {}: {}", status, toEmail, body);

            if (status == 401) {
                throw new UserException("Lỗi xác thực SendGrid API (401): Sai API Key (MAIL_PASSWORD) hoặc Key đã bị khóa. Chi tiết: " + body);
            }
            if (status == 403) {
                throw new UserException("Lỗi từ chối từ SendGrid API (403): Địa chỉ MAIL_FROM (" + mailFrom
                        + ") chưa được xác thực (Single Sender Verification) trên SendGrid hoặc API Key chưa bật quyền Mail Send. Chi tiết: " + body);
            }
            throw new UserException("Lỗi từ SendGrid Web API (" + status + "): " + body);
        } catch (Exception e) {
            log.error("Unexpected error calling SendGrid Web API for {}: {}", toEmail, e.getMessage(), e);
            throw new UserException("Không thể kết nối tới SendGrid Web API: " + e.getMessage());
        }
    }

    // =========================================================================
    // BƯỚC 1, 2, 3: NHẬN YÊU CẦU -> TẠO OTP 6 SỐ (5 PHÚT) -> GỬI QUA SENDGRID API
    // =========================================================================
    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse forgotPassword(String emailInput, String clientIp) throws Exception {
        if (emailInput == null || emailInput.trim().isEmpty()) {
            throw new UserException("Vui lòng nhập địa chỉ email hoặc tên đăng nhập.");
        }
        String cleanEmail = emailInput.trim().toLowerCase();

        checkAndRecordSuspiciousBehavior("IP:" + clientIp, false);
        checkAndRecordSuspiciousBehavior("EMAIL:" + cleanEmail, false);

        boolean senderConfigured = mailPassword != null && !mailPassword.isBlank()
                && !"abcd".equals(mailPassword.trim())
                && mailFrom != null && !mailFrom.isBlank();
        if (!senderConfigured) {
            throw new UserException("Lỗi cấu hình Sender: Thiếu MAIL_PASSWORD (SendGrid API Key) hoặc MAIL_FROM.");
        }

        final String genericSafeMessage = "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được gửi";

        User user = userRepository.findByEmail(cleanEmail);
        if (user == null) {
            ApiResponse response = new ApiResponse();
            response.setMessage(genericSafeMessage);
            return response;
        }

        enforcePasswordChangeLimits(user);

        Optional<PasswordResetToken> latestActiveToken =
                passwordResetTokenRepository.findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId());
        if (latestActiveToken.isPresent()) {
            PasswordResetToken existingToken = latestActiveToken.get();
            if (!existingToken.isExpired() && existingToken.getCreatedAt() != null) {
                long secondsElapsed = Duration.between(existingToken.getCreatedAt(), LocalDateTime.now()).getSeconds();
                if (secondsElapsed < 60) {
                    throw new UserException("Vui lòng đợi " + (60 - secondsElapsed) + " giây trước khi yêu cầu gửi lại mã OTP mới.");
                }
            }
        }

        passwordResetTokenRepository.invalidateAllActiveTokensByUserId(user.getId());

        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        String uniqueToken = UUID.randomUUID().toString();

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token(uniqueToken)
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

        String subject = "[POS Pro] Mã xác thực OTP khôi phục mật khẩu: " + otpCode;
        String htmlContent = """
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #111827; margin-top: 0;">Yêu cầu khôi phục mật khẩu</h2>
                    <p style="color: #374151; font-size: 14px;">Xin chào <strong>%s</strong>,</p>
                    <p style="color: #374151; font-size: 14px;">Mã xác thực OTP gồm 6 chữ số để đặt lại mật khẩu tài khoản POS Pro của bạn là:</p>
                    <div style="background: #f3f4f6; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #059669;">%s</span>
                    </div>
                    <p style="color: #dc2626; font-size: 13px;"><strong>Lưu ý:</strong> Mã OTP này có hiệu lực trong vòng <strong>5 phút</strong> và chỉ sử dụng 1 lần duy nhất.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
                </div>
                """.formatted(user.getFullName(), otpCode);

        // Bước 3: Gửi qua SendGrid Web API (HTTPS 443)
        sendEmailViaSendGridApi(user.getEmail(), subject, htmlContent);
        log.info("Đã gửi thành công email OTP khôi phục mật khẩu qua SendGrid Web API tới {}", user.getEmail());

        ApiResponse response = new ApiResponse();
        response.setMessage(genericSafeMessage);
        return response;
    }

    // =========================================================================
    // BƯỚC 4: XÁC THỰC MÃ OTP TỪ NGƯỜI DÙNG & CẤP RESET TICKET NGẮN HẠN
    // =========================================================================
    @Override
    @Transactional(rollbackFor = Exception.class, noRollbackFor = UserException.class)
    public Map<String, Object> verifyResetOtp(String emailInput, String otpInput, String clientIp) throws Exception {
        if (emailInput == null || emailInput.isBlank() || otpInput == null || otpInput.isBlank()) {
            throw new UserException("Vui lòng nhập đầy đủ email và mã OTP 6 chữ số.");
        }
        String cleanEmail = emailInput.trim().toLowerCase();
        String cleanOtp = otpInput.trim();

        checkAndRecordSuspiciousBehavior("IP:" + clientIp, false);

        User user = userRepository.findByEmail(cleanEmail);
        if (user == null) {
            checkAndRecordSuspiciousBehavior("IP:" + clientIp, true);
            throw new UserException("Mã OTP không chính xác hoặc đã hết hạn.");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findTopByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new UserException("Không tìm thấy yêu cầu khôi phục mật khẩu hợp lệ hoặc mã đã được sử dụng."));

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

        if (!cleanOtp.equals(resetToken.getOtpCode())) {
            resetToken.setAttemptCount(resetToken.getAttemptCount() + 1);
            int remaining = MAX_OTP_ATTEMPTS - resetToken.getAttemptCount();
            if (remaining <= 0) {
                resetToken.setUsed(true);
            }
            passwordResetTokenRepository.save(resetToken);
            checkAndRecordSuspiciousBehavior("IP:" + clientIp, true);
            throw new UserException(remaining > 0
                    ? ("Mã OTP không chính xác. Bạn còn " + remaining + " lần thử.")
                    : "Bạn đã nhập sai quá số lần quy định. Vui lòng lấy mã OTP mới.");
        }

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

    // =========================================================================
    // BƯỚC 5: CẬP NHẬT MẬT KHẨU MỚI (BCRYPT), GIỚI HẠN 5P/LẦN & 3 LẦN/NGÀY, HỦY JWT CŨ
    // =========================================================================
    @Override
    @Transactional(rollbackFor = Exception.class, noRollbackFor = UserException.class)
    public ApiResponse resetPassword(String resetTicket, String newPassword, String confirmPassword, String clientIp) throws Exception {
        if (resetTicket == null || resetTicket.trim().isEmpty()) {
            throw new UserException("Phiên đặt lại mật khẩu (Reset Ticket) không hợp lệ.");
        }
        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new UserException("Mật khẩu mới phải có ít nhất 6 ký tự.");
        }
        if (confirmPassword != null && !newPassword.equals(confirmPassword)) {
            throw new UserException("Mật khẩu xác nhận không khớp với mật khẩu mới.");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByResetTicket(resetTicket.trim())
                .orElseGet(() -> passwordResetTokenRepository.findByToken(resetTicket.trim()).orElse(null));

        if (resetToken == null || !resetToken.isOtpVerified()) {
            checkAndRecordSuspiciousBehavior("IP:" + clientIp, true);
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

        enforcePasswordChangeLimits(user);

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new UserException("Mật khẩu mới không được trùng với mật khẩu đang sử dụng.");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();
        user.setPassword(passwordEncoder.encode(newPassword));

        int currentDailyCount = (today.equals(user.getPasswordChangeCountDate()) && user.getDailyPasswordChangeCount() != null)
                ? user.getDailyPasswordChangeCount()
                : 0;
        user.setDailyPasswordChangeCount(currentDailyCount + 1);
        user.setPasswordChangeCountDate(today);
        user.setPasswordChangedAt(now);
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        ApiResponse response = new ApiResponse();
        response.setMessage("Đổi mật khẩu thành công! Toàn bộ các phiên đăng nhập cũ đã được đăng xuất để bảo vệ an toàn.");
        return response;
    }

    private Authentication authenticate(String email, String password) throws UserException {
        UserDetails userDetails;
        try {
            userDetails = customUserImplementation.loadUserByUsername(email);
        } catch (UsernameNotFoundException e) {
            throw new UserException("email id doesn't exist " + email);
        }
        if (userDetails == null) {
            throw new UserException("email id doesn't exist " + email);
        }
        if (!passwordEncoder.matches(password, userDetails.getPassword())) {
            throw new UserException("password doesn't match");
        }
        return new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
    }
}
