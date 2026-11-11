package com.zosh.service.impl;

import com.zosh.configuration.JwtProvider;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.AuthResponse;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.auth.PasswordResetService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtProvider jwtProvider;
    @Mock private CustomUserImplementation customUserImplementation;
    @Mock private PasswordResetService passwordResetService;

    @InjectMocks
    private AuthServiceImpl authService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void signup_rejectsNonOwnerRole() {
        UserDto dto = new UserDto();
        dto.setEmail("cashier@pos.vn");
        dto.setPassword("secret123");
        dto.setFullName("Cashier A");
        dto.setRole(UserRole.ROLE_CASHIER);

        when(userRepository.findByEmail("cashier@pos.vn")).thenReturn(null);

        UserException ex = assertThrows(UserException.class, () -> authService.signup(dto));
        assertTrue(ex.getMessage().contains("ROLE_STORE_OWNER"));
    }

    @Test
    void signup_validOwner_savesUserAndReturnsJwt() throws UserException {
        UserDto dto = new UserDto();
        dto.setEmail("owner@pos.vn");
        dto.setPassword("secret123");
        dto.setFullName("Owner A");

        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(null);
        when(passwordEncoder.encode("secret123")).thenReturn("$2a$encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(10L);
            return u;
        });
        UserDetails ud = org.springframework.security.core.userdetails.User
                .withUsername("owner@pos.vn").password("$2a$encoded").authorities("ROLE_STORE_OWNER").build();
        when(customUserImplementation.loadUserByUsername("owner@pos.vn")).thenReturn(ud);
        when(jwtProvider.generateToken(any())).thenReturn("jwt-token-123");

        AuthResponse response = authService.signup(dto);

        assertEquals("jwt-token-123", response.getJwt());
        assertEquals("Registered Successfully", response.getMessage());
        assertEquals(UserRole.ROLE_STORE_OWNER, response.getUser().getRole());
    }

    @Test
    void login_blocksDisabledAccount() {
        User user = new User();
        user.setId(1L);
        user.setEmail("staff@pos.vn");
        user.setPassword("$2a$hash");
        user.setRole(UserRole.ROLE_CASHIER);
        user.setLoginAccess(false);

        UserDetails ud = new org.springframework.security.core.userdetails.User(
                "staff@pos.vn", "$2a$hash", Collections.emptyList());
        when(customUserImplementation.loadUserByUsername("staff@pos.vn")).thenReturn(ud);
        when(passwordEncoder.matches("secret123", "$2a$hash")).thenReturn(true);
        when(userRepository.findByEmail("staff@pos.vn")).thenReturn(user);

        UserDto req = new UserDto();
        req.setEmail("staff@pos.vn");
        req.setPassword("secret123");

        UserException ex = assertThrows(UserException.class, () -> authService.login(req));
        assertTrue(ex.getMessage().contains("disabled"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void login_blocksBlockedStoreAccount() {
        Store blockedStore = new Store();
        blockedStore.setId(5L);
        blockedStore.setBrand("Fashion X");
        blockedStore.setStatus(StoreStatus.BLOCKED);
        Branch branch = Branch.builder().id(9L).store(blockedStore).build();

        User user = new User();
        user.setId(2L);
        user.setEmail("cashier@pos.vn");
        user.setPassword("$2a$hash");
        user.setRole(UserRole.ROLE_CASHIER);
        user.setLoginAccess(true);
        user.setStore(blockedStore);
        user.setBranch(branch);

        UserDetails ud = new org.springframework.security.core.userdetails.User(
                "cashier@pos.vn", "$2a$hash", Collections.emptyList());
        when(customUserImplementation.loadUserByUsername("cashier@pos.vn")).thenReturn(ud);
        when(passwordEncoder.matches("secret123", "$2a$hash")).thenReturn(true);
        when(userRepository.findByEmail("cashier@pos.vn")).thenReturn(user);

        UserDto req = new UserDto();
        req.setEmail("cashier@pos.vn");
        req.setPassword("secret123");

        UserException ex = assertThrows(UserException.class, () -> authService.login(req));
        assertTrue(ex.getMessage().contains("BLOCKED"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void login_activeOwner_updatesLastLoginAndReturnsJwt() throws UserException {
        Store store = new Store();
        store.setId(5L);
        store.setBrand("Fashion X");
        store.setStatus(StoreStatus.ACTIVE);

        User owner = new User();
        owner.setId(3L);
        owner.setEmail("owner@pos.vn");
        owner.setPassword("$2a$hash");
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setLoginAccess(true);
        owner.setStore(store);

        UserDetails ud = new org.springframework.security.core.userdetails.User(
                "owner@pos.vn", "$2a$hash", Collections.emptyList());
        when(customUserImplementation.loadUserByUsername("owner@pos.vn")).thenReturn(ud);
        when(passwordEncoder.matches("secret123", "$2a$hash")).thenReturn(true);
        when(userRepository.findByEmail("owner@pos.vn")).thenReturn(owner);
        when(jwtProvider.generateToken(any())).thenReturn("jwt-ok");

        UserDto req = new UserDto();
        req.setEmail("owner@pos.vn");
        req.setPassword("secret123");

        AuthResponse res = authService.login(req);

        assertEquals("jwt-ok", res.getJwt());
        assertNotNull(owner.getLastLogin());
        verify(userRepository).save(owner);
    }
}
