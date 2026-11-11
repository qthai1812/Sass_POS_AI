package com.zosh.service.employee;

import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.repository.*;
import com.zosh.service.ShiftReportService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeLifecycleServiceTest {

    @Mock private BranchRepository branchRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private BranchTransferRequestRepository branchTransferRequestRepository;
    @Mock private UserRepository userRepository;
    @Mock private ShiftReportService shiftReportService;

    @InjectMocks
    private EmployeeLifecycleService lifecycleService;

    @Test
    void syncManagedBranchAfterSave_assignsNewBranchAndClearsPreviousBranches() {
        User manager = new User();
        manager.setId(5L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);

        Branch oldBranch = Branch.builder().id(10L).manager(manager).build();
        Branch newBranch = Branch.builder().id(20L).build();
        when(branchRepository.findByManagerId(5L)).thenReturn(List.of(oldBranch, newBranch));

        lifecycleService.syncManagedBranchAfterSave(manager, newBranch);

        assertNull(oldBranch.getManager());
        assertEquals(manager, newBranch.getManager());
        verify(branchRepository).save(oldBranch);
        verify(branchRepository).save(newBranch);
    }

    @Test
    void closeOpenShiftsForEmployee_fallsBackToDirectCloseWhenEndShiftThrows() throws Exception {
        ShiftReport openShift = ShiftReport.builder().id(101L).shiftEnd(null).build();
        when(shiftReportRepository.findByCashierId(9L)).thenReturn(List.of(openShift));
        doThrow(new RuntimeException("err")).when(shiftReportService).closeShiftInternal(eq(101L), any());

        lifecycleService.closeOpenShiftsForEmployee(9L);

        assertNotNull(openShift.getShiftEnd());
        verify(shiftReportRepository).save(openShift);
    }

    @Test
    void deleteEmployeeWithCleanup_unlinksOrdersShiftsRefundsAndDeletesEmployee() throws Exception {
        User employee = new User();
        employee.setId(8L);
        employee.setRole(UserRole.ROLE_CASHIER);

        Order order = Order.builder().id(1L).cashier(employee).build();
        ShiftReport shift = ShiftReport.builder().id(2L).cashier(employee).shiftEnd(null).build();
        Refund refund = Refund.builder().id(3L).cashier(employee).build();

        when(branchRepository.findByManagerId(8L)).thenReturn(List.of());
        when(orderRepository.findByCashierId(8L)).thenReturn(List.of(order));
        when(shiftReportRepository.findByCashierId(8L)).thenReturn(List.of(shift));
        when(refundRepository.findByCashierId(8L)).thenReturn(List.of(refund));

        lifecycleService.deleteEmployeeWithCleanup(employee);

        verify(passwordResetTokenRepository).deleteByUserId(8L);
        verify(branchTransferRequestRepository).deleteByEmployeeId(8L);
        verify(shiftReportService).closeShiftInternal(eq(2L), any());
        assertNull(order.getCashier());
        assertNull(shift.getCashier());
        assertNull(refund.getCashier());
        verify(userRepository).delete(employee);
    }

    @Test
    void syncManagedBranchAfterSave_demotedUserClearsAllManagedBranches() {
        User cashier = new User();
        cashier.setId(7L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        Branch managed = Branch.builder().id(15L).manager(cashier).build();

        when(branchRepository.findByManagerId(7L)).thenReturn(List.of(managed));

        lifecycleService.syncManagedBranchAfterSave(cashier, null);

        assertNull(managed.getManager());
        verify(branchRepository).save(managed);
    }
}
