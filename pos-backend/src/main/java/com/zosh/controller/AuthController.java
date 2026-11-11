package com.zosh.controller;

import com.zosh.exceptions.UserException;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.AuthResponse;
import com.zosh.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @org.springframework.beans.factory.annotation.Value("${app.trust-proxy:false}")
    private boolean trustProxy;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signupHandler(@RequestBody UserDto userDto) throws UserException {
        return ResponseEntity.ok(authService.signup(userDto));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> loginHandler(@RequestBody UserDto userDto) throws UserException {
        return ResponseEntity.ok(authService.login(userDto));
    }

    // Bước 1, 2, 3: Gửi yêu cầu khôi phục mật khẩu & nhận OTP qua SendGrid
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse> forgotPasswordHandler(
            @RequestBody ForgotPasswordRequest req,
            HttpServletRequest httpRequest
    ) throws Exception {
        String clientIp = extractClientIp(httpRequest);
        try {
            ApiResponse response = authService.forgotPassword(req.getEmail(), clientIp);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("RATE_LIMIT_OTP:")) {
                String sec = e.getMessage().split(":")[1];
                throw new UserException("Vui lòng đợi " + sec + " giây trước khi yêu cầu gửi lại mã OTP mới.");
            }
            throw e;
        }
    }

    // Bước 4: Xác thực mã OTP 6 chữ số -> trả về resetTicket ngắn hạn
    @PostMapping("/verify-reset-otp")
    public ResponseEntity<Map<String, Object>> verifyResetOtpHandler(
            @RequestBody VerifyOtpRequest req,
            HttpServletRequest httpRequest
    ) throws Exception {
        String clientIp = extractClientIp(httpRequest);
        return ResponseEntity.ok(authService.verifyResetOtp(req.getEmail(), req.getOtp(), clientIp));
    }

    // Bước 5: Đặt lại mật khẩu mới bằng resetTicket
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse> resetPasswordHandler(
            @RequestBody ResetPasswordRequest req,
            HttpServletRequest httpRequest
    ) throws Exception {
        String clientIp = extractClientIp(httpRequest);
        String ticketOrToken = (req.getResetTicket() != null && !req.getResetTicket().isBlank())
                ? req.getResetTicket()
                : req.getToken();
        return ResponseEntity.ok(authService.resetPassword(
                ticketOrToken,
                req.getPassword(),
                req.getConfirmPassword(),
                clientIp
        ));
    }

    private String extractClientIp(HttpServletRequest request) {
        if (trustProxy) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                return xff.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }

    @Data
    public static class ForgotPasswordRequest {
        private String email;
    }

    @Data
    public static class VerifyOtpRequest {
        private String email;
        private String otp;
    }

    @Data
    public static class ResetPasswordRequest {
        private String resetTicket;
        private String token; // Tương thích ngược
        private String password;
        private String confirmPassword;
    }
}
