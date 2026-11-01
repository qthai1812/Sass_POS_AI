package com.zosh.controller;

import com.zosh.exceptions.UserException;
import com.zosh.modal.Customer;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.CustomerService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CustomerService customerService;

    @GetMapping("/profile")
    public ResponseEntity<UserDto> getUserProfile(
            @RequestHeader("Authorization") String jwt
    ) throws UserException {
        return ResponseEntity.ok(userService.getUserProfileDto(jwt));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDto> updateProfile(
            @RequestBody UserDto userDto
    ) throws UserException {
        return ResponseEntity.ok(userService.updateProfileDto(userDto));
    }

    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @RequestBody Map<String, String> body
    ) throws UserException {
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        userService.changePassword(currentPassword, newPassword);
        ApiResponse res = new ApiResponse();
        res.setMessage("Password changed successfully");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/list")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUserDtos());
    }

    @GetMapping("/cashier")
    public ResponseEntity<List<UserDto>> getCashiers() {
        return ResponseEntity.ok(userService.getCashierDtos());
    }

    @GetMapping("/customer")
    public ResponseEntity<List<Customer>> getCustomers() throws Exception {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUserById(
            @RequestHeader(value = "Authorization", required = false) String jwt,
            @PathVariable long id
    ) throws UserException, Exception {
        return ResponseEntity.ok(userService.getUserDtoById(id));
    }
}
