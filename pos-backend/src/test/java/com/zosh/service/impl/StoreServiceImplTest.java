package com.zosh.service.impl;

import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.modal.*;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.ShiftReportService;
import com.zosh.service.UserService;
import com.zosh.service.store.StoreCascadeDeletionService;
import com.zosh.service.store.StoreRevenueEnricher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoreServiceImplTest {

    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private UserService userService;
    @Mock private ShiftReportService shiftReportService;
    @Mock private StoreRevenueEnricher storeRevenueEnricher;
    @Mock private StoreCascadeDeletionService cascadeDeletionService;

    @InjectMocks
    private StoreServiceImpl storeService;

    private User owner;
    private User superAdmin;
    private Store store;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        superAdmin = new User();
        superAdmin.setId(1L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);

        store = new Store();
        store.setId(100L);
        store.setBrand("Fashion Hub");
        store.setStoreAdmin(owner);
        store.setStatus(StoreStatus.ACTIVE);
        store.setCommissionRate(2.5);
    }

    @Test
    void createStore_nonOwnerRole_throwsAccessDenied() {
        User cashier = new User();
        cashier.setId(20L);
        cashier.setRole(UserRole.ROLE_CASHIER);

        assertThrows(AccessDeniedException.class, () -> storeService.createStore(new StoreDTO(), cashier));
        verify(storeRepository, never()).save(any());
    }

    @Test
    void createStore_newOwnerStore_savesStoreAndLinksBackToOwner() {
        StoreDTO req = new StoreDTO();
        req.setBrand("New Fashion");

        when(storeRepository.findByStoreAdminId(10L)).thenReturn(null);
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> {
            Store s = inv.getArgument(0);
            s.setId(55L);
            return s;
        });
        when(storeRevenueEnricher.enrich(any(StoreDTO.class), eq(0.0))).thenAnswer(inv -> inv.getArgument(0));

        StoreDTO result = storeService.createStore(req, owner);

        assertEquals(55L, result.getId());
        assertEquals(55L, owner.getStore().getId());
        verify(userRepository).save(owner);
    }

    @Test
    void getAllStores_whenUserNotAuthenticated_returnsEmptyList() throws UserException {
        when(userService.getCurrentUser()).thenThrow(new UserException("No user"));

        assertTrue(storeService.getAllStores(null).isEmpty());
    }

    @Test
    void updateStore_rejectedStoreEditedByOwner_resetsToPendingAndMergesContact() throws Exception {
        store.setStatus(StoreStatus.REJECTED);
        store.setRejectionReason("Invalid docs");
        store.setContact(StoreContact.builder().address("Old Addr").phone("0901").build());

        when(userService.getCurrentUser()).thenReturn(owner);
        when(userService.getCurrentUserAllowingBlockedStore()).thenReturn(owner);
        when(storeRepository.findByStoreAdminId(10L)).thenReturn(store);
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));
        when(storeRevenueEnricher.toEnrichedDTO(store)).thenAnswer(inv -> {
            StoreDTO dto = new StoreDTO();
            dto.setStatus(store.getStatus());
            dto.setRejectionReason(store.getRejectionReason());
            return dto;
        });

        StoreDTO patch = new StoreDTO();
        patch.setBrand("Fashion Hub Updated");
        patch.setCommissionRate(0.1); // Owner must NOT override commission rate
        patch.setContact(StoreContact.builder().phone("0999").build());

        StoreDTO updated = storeService.updateStore(100L, patch);

        assertEquals(StoreStatus.PENDING, updated.getStatus());
        assertNull(updated.getRejectionReason());
        assertEquals(2.5, store.getCommissionRate());
        assertEquals("Old Addr", store.getContact().getAddress());
        assertEquals("0999", store.getContact().getPhone());
    }

    @Test
    void moderateStore_activeToPending_throwsIllegalState() throws Exception {
        store.setStatus(StoreStatus.ACTIVE);
        when(userService.getCurrentUser()).thenReturn(superAdmin);
        when(storeRepository.findById(100L)).thenReturn(Optional.of(store));

        assertThrows(IllegalStateException.class,
                () -> storeService.moderateStore(100L, StoreStatus.PENDING, null));
    }

    @Test
    void moderateStore_toBlocked_autoClosesOpenShiftsWithFallbackOnError() throws Exception {
        ShiftReport openShift = ShiftReport.builder().id(501L).shiftEnd(null).build();
        ShiftReport closedShift = ShiftReport.builder().id(502L).shiftEnd(java.time.LocalDateTime.now()).build();

        when(userService.getCurrentUser()).thenReturn(superAdmin);
        when(storeRepository.findById(100L)).thenReturn(Optional.of(store));
        when(shiftReportRepository.findByBranchStoreId(100L)).thenReturn(List.of(openShift, closedShift));
        doThrow(new RuntimeException("shift error")).when(shiftReportService).closeShiftInternal(eq(501L), any());
        when(storeRepository.save(store)).thenReturn(store);
        when(storeRevenueEnricher.toEnrichedDTO(store)).thenReturn(new StoreDTO());

        storeService.moderateStore(100L, StoreStatus.BLOCKED, "Violation");

        assertEquals(StoreStatus.BLOCKED, store.getStatus());
        assertNotNull(openShift.getShiftEnd());
        verify(shiftReportRepository).save(openShift);
        verify(shiftReportService, never()).closeShiftInternal(eq(502L), any());
    }

    @Test
    void deleteStore_unauthorizedUser_throwsUserException() throws UserException {
        User otherOwner = new User();
        otherOwner.setId(99L);
        otherOwner.setRole(UserRole.ROLE_STORE_OWNER);

        when(userService.getCurrentUser()).thenReturn(otherOwner);
        when(storeRepository.findById(100L)).thenReturn(Optional.of(store));

        assertThrows(UserException.class, () -> storeService.deleteStore(100L));
        verify(cascadeDeletionService, never()).deleteStoreCascade(any());
    }

    @Test
    void deleteStore_byOwner_delegatesToCascadeDeletion() throws UserException {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(storeRepository.findById(100L)).thenReturn(Optional.of(store));

        storeService.deleteStore(100L);

        verify(cascadeDeletionService).deleteStoreCascade(store);
    }
}
