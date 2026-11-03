package com.zosh.service;

import com.zosh.exceptions.UserException;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.AuthResponse;

import java.util.Map;

public interface AuthService {

    AuthResponse signup(UserDto userDto) throws UserException;
    AuthResponse login(UserDto userDto) throws UserException;

    // Bước 1, 2, 3: Yêu cầu gửi OTP qua SendGrid
    ApiResponse forgotPassword(String email, String clientIp) throws Exception;

    // Bước 4: Xác thực OTP 6 số và cấp Reset Ticket ngắn hạn
    Map<String, Object> verifyResetOtp(String email, String otp, String clientIp) throws Exception;

    // Bước 5: Đặt lại mật khẩu mới bằng Reset Ticket, kiểm tra giới hạn 5p/lần & 3 lần/ngày, hủy JWT cũ
    ApiResponse resetPassword(String resetTicket, String newPassword, String confirmPassword, String clientIp) throws Exception;
}
