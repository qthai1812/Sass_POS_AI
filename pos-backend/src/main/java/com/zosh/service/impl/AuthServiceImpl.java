package com.zosh.service.impl;

import com.zosh.configuration.JwtProvider;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.AuthResponse;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AuthService;
import com.zosh.service.auth.PasswordPolicyService;
import com.zosh.service.auth.PasswordResetService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final CustomUserImplementation customUserImplementation;
    private final PasswordResetService passwordResetService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse signup(UserDto userDto) throws UserException {
        validateSignupInput(userDto);

        String normalizedEmail = userDto.getEmail().trim();
        if (userRepository.findByEmail(normalizedEmail) != null) {
            throw new UserException("email id already registered");
        }

        UserRole assignedRole = userDto.getRole() != null ? userDto.getRole() : UserRole.ROLE_STORE_OWNER;
        if (assignedRole != UserRole.ROLE_STORE_OWNER) {
            throw new UserException("Public registration is only allowed for ROLE_STORE_OWNER");
        }

        User newUser = new User();
        newUser.setEmail(normalizedEmail);
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
        Authentication authentication = authenticate(email, userDto.getPassword());
        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByEmail(email);
        assertLoginAllowed(user);

        Store effectiveStore = resolveEffectiveStoreAndValidateAccess(user);

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
    public ApiResponse forgotPassword(String emailInput, String clientIp) throws Exception {
        return passwordResetService.forgotPassword(emailInput, clientIp);
    }

    @Override
    public Map<String, Object> verifyResetOtp(String emailInput, String otpInput, String clientIp) throws Exception {
        return passwordResetService.verifyResetOtp(emailInput, otpInput, clientIp);
    }

    @Override
    public ApiResponse resetPassword(String resetTicket, String newPassword, String confirmPassword, String clientIp) throws Exception {
        return passwordResetService.resetPassword(resetTicket, newPassword, confirmPassword, clientIp);
    }

    private void validateSignupInput(UserDto userDto) throws UserException {
        if (userDto == null || userDto.getEmail() == null || userDto.getEmail().trim().isEmpty()) {
            throw new UserException("Email is required");
        }
        if (userDto.getPassword() == null || userDto.getPassword().trim().length() < PasswordPolicyService.MIN_PASSWORD_LENGTH) {
            throw new UserException("Password must be at least 6 characters");
        }
        if (userDto.getFullName() == null || userDto.getFullName().trim().isEmpty()) {
            throw new UserException("Full name is required");
        }
    }

    private void assertLoginAllowed(User user) throws UserException {
        if (user != null && Boolean.FALSE.equals(user.getLoginAccess())) {
            SecurityContextHolder.clearContext();
            throw new UserException("Login access for this account has been disabled by your manager.");
        }
    }

    private Store resolveEffectiveStoreAndValidateAccess(User user) throws UserException {
        if (user == null || user.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            return null;
        }
        Store effectiveStore = user.getStore();
        if (effectiveStore == null && user.getBranch() != null) {
            effectiveStore = user.getBranch().getStore();
        }
        if (effectiveStore == null) {
            effectiveStore = storeRepository.findByStoreAdminId(user.getId());
        }

        if ((user.getRole() == UserRole.ROLE_CASHIER || user.getRole() == UserRole.ROLE_BRANCH_MANAGER)
                && (user.getBranch() == null || effectiveStore == null)) {
            SecurityContextHolder.clearContext();
            throw new UserException("Your account is not assigned to an active branch or store. Please contact your Store Owner.");
        }

        if (effectiveStore != null && effectiveStore.getStatus() == StoreStatus.BLOCKED) {
            SecurityContextHolder.clearContext();
            throw new UserException(
                    "Store \"" + effectiveStore.getBrand() + "\" has been BLOCKED by Super Admin. Access is suspended for all accounts in this store."
            );
        }
        return effectiveStore;
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
