package com.zosh.service.impl;

import com.zosh.domain.BranchTransferRequestStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.BranchTransferRequest;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.BranchTransferRequestDTO;
import com.zosh.payload.dto.BranchTransferSummaryDTO;
import com.zosh.payload.response.PageResponse;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.BranchTransferRequestRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.ShiftReportService;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BranchTransferRequestServiceImplTest {

    @Mock private BranchTransferRequestRepository transferRequestRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private ShiftReportService shiftReportService;
    @Mock private UserService userService;
    @Mock private AccessControlService accessControl;

    @InjectMocks
    private BranchTransferRequestServiceImpl service;

    private Store store;
    private User owner;
    private User cashier;
    private BranchTransferRequest request;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Fashion Co");

        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(store);

        cashier = new User();
        cashier.setId(20L);
        cashier.setFullName("Tran Thu Ngan");
        cashier.setRole(UserRole.ROLE_CASHIER);

        Branch b1 = Branch.builder().id(101L).name("CN 1").store(store).build();
        Branch b2 = Branch.builder().id(102L).name("CN 2").store(store).build();

        request = BranchTransferRequest.builder()
                .id(500L)
                .employee(cashier)
                .store(store)
                .fromBranch(b1)
                .toBranch(b2)
                .reason("Gần nhà")
                .status(BranchTransferRequestStatus.PENDING)
                .build();
    }

    @Test
    void getStoreRequestsPaged_byStoreOwner_returnsPagedDtos() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(accessControl.isStoreLevelUser(owner, store)).thenReturn(true);

        Page<BranchTransferRequest> page = new PageImpl<>(List.of(request), PageRequest.of(0, 10), 1);
        when(transferRequestRepository.findByStoreIdPaged(eq(1L), eq(BranchTransferRequestStatus.PENDING), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<BranchTransferRequestDTO> res = service.getStoreRequestsPaged(
                1L, BranchTransferRequestStatus.PENDING, 0, 10, "createdAt", "desc"
        );

        assertEquals(1, res.getContent().size());
        assertEquals("CN 1", res.getContent().get(0).getFromBranchName());
        assertEquals("CN 2", res.getContent().get(0).getToBranchName());
    }

    @Test
    void getStoreRequestSummary_returnsTotalAndPendingCounts() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(accessControl.isStoreLevelUser(owner, store)).thenReturn(true);
        when(transferRequestRepository.countByStoreId(1L)).thenReturn(15L);
        when(transferRequestRepository.countByStoreIdAndStatus(1L, BranchTransferRequestStatus.PENDING)).thenReturn(4L);

        BranchTransferSummaryDTO summary = service.getStoreRequestSummary(1L);

        assertEquals(15L, summary.getTotalRequests());
        assertEquals(4L, summary.getPendingRequests());
    }

    @Test
    void getStoreRequestsPaged_unauthorized_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(accessControl.isStoreLevelUser(cashier, store)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () ->
                service.getStoreRequestsPaged(1L, null, 0, 10, "createdAt", "desc")
        );
    }
}
