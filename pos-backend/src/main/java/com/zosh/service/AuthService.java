package com.zosh.service;

import com.zosh.exceptions.UserException;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.AuthResponse;

public interface AuthService {

    AuthResponse signup(UserDto userDto) throws UserException;
    AuthResponse login(UserDto userDto) throws UserException;
    ApiResponse forgotPassword(String email) throws Exception;
    ApiResponse resetPassword(String token, String newPassword) throws Exception;
}

