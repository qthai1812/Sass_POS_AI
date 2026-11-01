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
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final CustomUserImplementation customUserImplementation;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final JavaMailSender mailSender;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse signup(UserDto userDto) throws UserException {
        if (userDto == null || userDto.getEmail() == null || userDto.getEmail().trim().isEmpty()) {
            throw new UserException("Email is required");
        }
        if (userDto.getPassword() == null || userDto.getPassword().trim().isEmpty()) {
            throw new UserException("Password is required");
        }
        if (userDto.getFullName() == null || userDto.getFullName().trim().isEmpty()) {
            throw new UserException("Full name is required");
        }

        User user = userRepository.findByEmail(userDto.getEmail().trim());
        if (user != null) {
            throw new UserException("email id already registered");
        }

        // Chặn leo thang đặc quyền: đăng ký công khai chỉ dành cho chủ cửa hàng (ROLE_STORE_ADMIN)
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

            // Chặn các tài khoản nhân viên mồ côi (Store hoặc Branch đã bị xóa) đăng nhập vào giao diện lỗi
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse forgotPassword(String email) throws Exception {
        if (email == null || email.trim().isEmpty()) {
            throw new UserException("Email is required");
        }
        User user = userRepository.findByEmail(email.trim());
        if (user == null) {
            throw new Exception("No account found with email: " + email);
        }

        boolean smtpConfigured = mailUsername != null && !mailUsername.isBlank()
                && mailPassword != null && !mailPassword.isBlank();
        if (!smtpConfigured) {
            throw new UserException("Email service (SMTP) is not configured on the server. Please configure MAIL_USERNAME and MAIL_PASSWORD.");
        }

        passwordResetTokenRepository.deleteByUserId(user.getId());

        String tokenValue = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token(tokenValue)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false)
                .build();
        passwordResetTokenRepository.save(resetToken);

        String resetLink = frontendUrl + "/auth/reset-password?token=" + tokenValue;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailUsername.trim());
            message.setTo(email.trim());
            message.setSubject("POS Pro — Password Reset Request");
            message.setText(
                    "Hello " + user.getFullName() + ",\n\n" +
                    "We received a request to reset your password.\n\n" +
                    "Click the link below to reset it (valid for 1 hour):\n" +
                    resetLink + "\n\n" +
                    "If you did not request a password reset, please ignore this email.\n\n" +
                    "Best regards,\nPOS Pro Team"
            );
            mailSender.send(message);
        } catch (Exception e) {
            // Tuyệt đối không ghi resetLink / token ra log để tránh lộ token đặt lại mật khẩu
            log.error("Failed to send password reset email to {}: {}", email.trim(), e.getMessage());
            throw new UserException("Could not send password reset email. Please verify SMTP settings or try again later.");
        }

        ApiResponse response = new ApiResponse();
        response.setMessage("Password reset link sent to " + email);
        return response;
    }

    @Override
    @Transactional(rollbackFor = Exception.class, noRollbackFor = UserException.class)
    public ApiResponse resetPassword(String token, String newPassword) throws Exception {
        if (newPassword == null || newPassword.trim().length() < 6) {
            throw new UserException("New password must be at least 6 characters");
        }
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token)
                .orElseThrow(() -> new UserException("Invalid or expired reset token"));

        if (resetToken.isExpired()) {
            passwordResetTokenRepository.delete(resetToken);
            throw new UserException("Reset token has expired. Please request a new one.");
        }
        if (resetToken.isUsed()) {
            throw new Exception("This reset token has already been used.");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        ApiResponse response = new ApiResponse();
        response.setMessage("Password reset successfully. You can now log in.");
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
