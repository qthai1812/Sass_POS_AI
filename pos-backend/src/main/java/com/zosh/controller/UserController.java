package com.zosh.controller;

import com.zosh.configuration.JwtProvider;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Customer;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.CustomerService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CustomerService customerService;
    private final JwtProvider jwtProvider;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/profile")
    public ResponseEntity<UserDto> getUserProfile(
            @RequestHeader("Authorization") String jwt
    ) throws UserException {
        return ResponseEntity.ok(userService.getUserProfileDto(jwt));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/profile")
    public ResponseEntity<UserDto> updateProfile(
            @RequestBody UserDto userDto
    ) throws UserException {
        return ResponseEntity.ok(userService.updateProfileDto(userDto));
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @RequestBody Map<String, String> body
    ) throws UserException {
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        userService.changePassword(currentPassword, newPassword);
        ApiResponse res = new ApiResponse();
        res.setMessage("Password changed successfully");
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            res.setJwt(jwtProvider.generateToken(auth));
        }
        return ResponseEntity.ok(res);
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER', 'BRANCH_MANAGER')")
    @GetMapping("/list")
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUserDtos());
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER')")
    @GetMapping("/cashier")
    public ResponseEntity<List<UserDto>> getCashiers() {
        return ResponseEntity.ok(userService.getCashierDtos());
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/customer")
    public ResponseEntity<List<Customer>> getCustomers() throws Exception {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER', 'BRANCH_MANAGER')")
    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUserById(
            @RequestHeader(value = "Authorization", required = false) String jwt,
            @PathVariable long id
    ) throws UserException, Exception {
        return ResponseEntity.ok(userService.getUserDtoById(id));
    }
}
