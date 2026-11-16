package com.zosh.service.impl;

import com.zosh.domain.SubscriptionStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Store;
import com.zosh.modal.Subscription;
import com.zosh.modal.User;
import com.zosh.payload.dto.SubscriptionDTO;
import com.zosh.payload.response.PageResponse;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceImplTest {

    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private SubscriptionPlanRepository subscriptionPlanRepository;
    @Mock private UserService userService;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private PaymentGatewayService paymentGatewayService;

    @InjectMocks
    private SubscriptionServiceImpl subscriptionService;

    private User superAdmin;
    private User owner;
    private Subscription subscription;

    @BeforeEach
    void setUp() {
        superAdmin = new User();
        superAdmin.setId(1L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);

        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        Store store = new Store();
        store.setId(5L);
        store.setBrand("Linen Studio");

        subscription = Subscription.builder()
                .id(77L)
                .store(store)
                .planName("Pro Monthly")
                .status(SubscriptionStatus.ACTIVE)
                .amount(299000.0)
                .endDate(LocalDateTime.now().plusDays(3))
                .build();
    }

    @Test
    void getAllSubscriptionsPaged_withoutExpiringDays_filtersByStatus() throws Exception {
        when(userService.getCurrentUser()).thenReturn(superAdmin);
        Page<Subscription> page = new PageImpl<>(List.of(subscription), PageRequest.of(0, 10), 1);
        when(subscriptionRepository.findAdminByStatusPaged(eq(SubscriptionStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<SubscriptionDTO> res = subscriptionService.getAllSubscriptionsPaged(
                SubscriptionStatus.ACTIVE, null, 0, 10, "createdAt", "desc"
        );

        assertEquals(1, res.getContent().size());
        assertEquals("Linen Studio", res.getContent().get(0).getStoreName());
        verify(subscriptionRepository).findAdminByStatusPaged(eq(SubscriptionStatus.ACTIVE), any(Pageable.class));
        verify(subscriptionRepository, never()).findAdminExpiringPaged(any(), anyCollection(), any());
    }

    @Test
    void getAllSubscriptionsPaged_withExpiringDays_queriesExpiringWindow() throws Exception {
        when(userService.getCurrentUser()).thenReturn(superAdmin);
        Page<Subscription> page = new PageImpl<>(List.of(subscription), PageRequest.of(0, 10), 1);
        when(subscriptionRepository.findAdminExpiringPaged(any(LocalDateTime.class), anyCollection(), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<SubscriptionDTO> res = subscriptionService.getAllSubscriptionsPaged(
                null, 7, 0, 10, "endDate", "asc"
        );

        assertEquals(1, res.getContent().size());
        verify(subscriptionRepository).findAdminExpiringPaged(any(LocalDateTime.class), anyCollection(), any(Pageable.class));
    }

    @Test
    void getAllSubscriptionsPaged_nonSuperAdmin_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        assertThrows(AccessDeniedException.class, () ->
                subscriptionService.getAllSubscriptionsPaged(null, null, 0, 10, "createdAt", "desc")
        );
    }
}
