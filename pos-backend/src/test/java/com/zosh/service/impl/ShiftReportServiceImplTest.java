package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.UserService;
import com.zosh.service.shift.ShiftMetricsCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShiftReportServiceImplTest {

    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private UserService userService;
    @Mock private BranchRepository branchRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private AccessControlService accessControl;
    @Spy private ShiftMetricsCalculator metricsCalculator = new ShiftMetricsCalculator();

    @InjectMocks
    private ShiftReportServiceImpl shiftReportService;

    private Store activeStore;
    private Branch branch;
    private User cashier;
    private User owner;

    @BeforeEach
    void setUp() {
        activeStore = new Store();
        activeStore.setId(1L);
        activeStore.setStatus(StoreStatus.ACTIVE);

        branch = Branch.builder().id(10L).name("Main Branch").store(activeStore).build();

        cashier = new User();
        cashier.setId(100L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setBranch(branch);
        cashier.setStore(activeStore);

        owner = new User();
        owner.setId(200L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(activeStore);
    }

    @Test
    void startShift_alreadyActive_returnsCurrentShiftProgress() throws Exception {
        ShiftReport openShift = ShiftReport.builder()
                .id(5L)
                .cashier(cashier)
                .branch(branch)
                .shiftStart(LocalDateTime.now().minusHours(2))
                .build();

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(openShift));
        when(orderRepository.findShiftOrdersByBranchAndCashierBetween(eq(10L), eq(100L), any(), any()))
                .thenReturn(Collections.emptyList());
        when(refundRepository.findByShiftReportId(5L)).thenReturn(Collections.emptyList());

        ShiftReportDTO dto = shiftReportService.startShift(null);

        assertEquals(5L, dto.getId());
        verify(shiftReportRepository, never()).save(any());
    }

    @Test
    void startShift_nonCashier_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);

        assertThrows(AccessDeniedException.class, () -> shiftReportService.startShift(null));
        assertThrows(AccessDeniedException.class, () -> shiftReportService.endShift(null, LocalDateTime.now()));
        verify(shiftReportRepository, never()).save(any());
    }

    @Test
    void startShift_cashierWithAssignedBranch_startsNewShiftSuccessfully() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());
        when(shiftReportRepository.save(any(ShiftReport.class))).thenAnswer(inv -> {
            ShiftReport s = inv.getArgument(0);
            s.setId(77L);
            return s;
        });

        ShiftReportDTO dto = shiftReportService.startShift(null);

        assertEquals(77L, dto.getId());
        assertEquals(10L, dto.getBranchId());
    }

    @Test
    void startShift_blockedStore_throwsException() throws Exception {
        activeStore.setStatus(StoreStatus.BLOCKED);
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());

        Exception ex = assertThrows(Exception.class, () -> shiftReportService.startShift(null));
        assertTrue(ex.getMessage().contains("blocked"));
    }

    @Test
    void startShift_pendingStore_throwsException() throws Exception {
        activeStore.setStatus(StoreStatus.PENDING);
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());

        Exception ex = assertThrows(Exception.class, () -> shiftReportService.startShift(null));
        assertTrue(ex.getMessage().contains("pending"));
    }

    @Test
    void endShift_activeShift_calculatesTotalsAndPersistsSnapshot() throws Exception {
        ShiftReport openShift = ShiftReport.builder()
                .id(20L)
                .cashier(cashier)
                .branch(branch)
                .shiftStart(LocalDateTime.now().minusHours(4))
                .build();

        Order o1 = Order.builder().id(1L).status(OrderStatus.COMPLETED).totalAmount(200000.0).build();
        Order o2 = Order.builder().id(2L).status(OrderStatus.PENDING).totalAmount(999999.0).build();
        Refund r1 = Refund.builder().id(3L).amount(50000.0).build();

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(openShift));
        when(refundRepository.findByShiftReportId(20L)).thenReturn(List.of(r1));
        when(orderRepository.findShiftOrdersByBranchAndCashierBetween(eq(10L), eq(100L), any(), any()))
                .thenReturn(List.of(o1, o2));
        when(shiftReportRepository.save(any(ShiftReport.class))).thenAnswer(inv -> inv.getArgument(0));

        ShiftReportDTO result = shiftReportService.endShift(null, LocalDateTime.now());

        assertEquals(200000.0, result.getTotalSales());
        assertEquals(50000.0, result.getTotalRefunds());
        assertEquals(150000.0, result.getNetSale());
        assertEquals(1, result.getTotalOrders());
        assertEquals(1, result.getRefunds().size());
        verify(shiftReportRepository).save(openShift);
    }

    @Test
    void getShiftReportById_closedShiftPreservesSavedSnapshotTotals() throws Exception {
        ShiftReport closedShift = ShiftReport.builder()
                .id(30L)
                .cashier(cashier)
                .branch(branch)
                .shiftStart(LocalDateTime.now().minusDays(1))
                .shiftEnd(LocalDateTime.now().minusDays(1).plusHours(8))
                .totalSales(500000.0)
                .totalRefunds(0.0)
                .netSale(500000.0)
                .totalOrders(5)
                .build();

        when(shiftReportRepository.findById(30L)).thenReturn(Optional.of(closedShift));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findShiftOrdersByBranchAndCashierBetween(any(), any(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(refundRepository.findByShiftReportId(30L))
                .thenReturn(List.of(Refund.builder().id(9L).amount(100000.0).build()));

        ShiftReportDTO dto = shiftReportService.getShiftReportById(30L);

        assertEquals(500000.0, dto.getTotalSales());
        assertEquals(0.0, dto.getTotalRefunds());
        assertEquals(500000.0, dto.getNetSale());
        assertEquals(5, dto.getTotalOrders());
    }

    @Test
    void getAllShiftReports_avoidsQueriesForClosedShifts() throws Exception {
        ShiftReport closed = ShiftReport.builder()
                .id(1L).cashier(cashier).branch(branch)
                .shiftStart(LocalDateTime.now().minusDays(2))
                .shiftEnd(LocalDateTime.now().minusDays(2).plusHours(8))
                .totalSales(100000.0).totalRefunds(0.0).netSale(100000.0).totalOrders(1)
                .build();
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findByCashierId(100L)).thenReturn(List.of(closed));

        List<ShiftReportDTO> list = shiftReportService.getAllShiftReports();

        assertEquals(1, list.size());
        assertEquals(100000.0, list.get(0).getNetSale());
        verifyNoInteractions(orderRepository);
    }

    @Test
    void getShiftReportById_unauthorizedUser_throwsAccessDenied() throws Exception {
        User stranger = new User();
        stranger.setId(999L);
        stranger.setRole(UserRole.ROLE_CASHIER);
        ShiftReport report = ShiftReport.builder().id(40L).cashier(cashier).branch(branch).build();

        when(shiftReportRepository.findById(40L)).thenReturn(Optional.of(report));
        when(userService.getCurrentUser()).thenReturn(stranger);
        when(accessControl.canManageBranch(stranger, branch)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> shiftReportService.getShiftReportById(40L));
    }
}
