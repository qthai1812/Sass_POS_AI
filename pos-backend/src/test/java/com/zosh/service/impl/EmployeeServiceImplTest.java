package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.PasswordResetTokenRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import com.zosh.service.employee.EmployeeLifecycleService;
import com.zosh.service.employee.EmployeePermissionValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceImplTest {

    @Mock private UserRepository userRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserService userService;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private AccessControlService accessControl;
    @Mock private EmployeePermissionValidator permissionValidator;
    @Mock private EmployeeLifecycleService lifecycleService;

    @InjectMocks
    private EmployeeServiceImpl employeeService;

    private Store store;
    private Branch branchA;
    private User owner;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Fashion Co");
        branchA = Branch.builder().id(10L).name("Branch A").store(store).build();

        owner = new User();
        owner.setId(100L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(store);
    }

    @Test
    void createStoreEmployee_branchManager_savesAndSyncsManagedBranch() throws Exception {
        UserDto req = new UserDto();
        req.setEmail(" mgr@pos.vn ");
        req.setFullName("Manager A");
        req.setPassword("secret123");
        req.setRole(UserRole.ROLE_BRANCH_MANAGER);
        req.setBranchId(10L);

        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(userRepository.findByEmail("mgr@pos.vn")).thenReturn(null);
        when(branchRepository.findById(10L)).thenReturn(Optional.of(branchA));
        when(passwordEncoder.encode("secret123")).thenReturn("$hash$");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(200L);
            return u;
        });

        UserDto created = employeeService.createStoreEmployee(req, 1L);

        assertEquals(200L, created.getId());
        assertEquals("mgr@pos.vn", created.getEmail());
        verify(planLimitChecker).checkUserLimit(store);
        verify(lifecycleService).syncManagedBranchAfterSave(argThat(u -> u.getId().equals(200L)), eq(branchA));
    }

    @Test
    void createStoreEmployee_crossStoreBranch_throwsException() {
        Store otherStore = new Store();
        otherStore.setId(2L);
        Branch foreignBranch = Branch.builder().id(99L).store(otherStore).build();

        UserDto req = new UserDto();
        req.setEmail("c@pos.vn");
        req.setFullName("C");
        req.setPassword("123456");
        req.setRole(UserRole.ROLE_CASHIER);
        req.setBranchId(99L);

        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(userRepository.findByEmail("c@pos.vn")).thenReturn(null);
        when(branchRepository.findById(99L)).thenReturn(Optional.of(foreignBranch));

        Exception ex = assertThrows(Exception.class, () -> employeeService.createStoreEmployee(req, 1L));
        assertTrue(ex.getMessage().contains("does not belong"));
    }

    @Test
    void createBranchEmployee_byBranchManager_throwsAccessDenied() throws Exception {
        User branchMgr = new User();
        branchMgr.setId(50L);
        branchMgr.setRole(UserRole.ROLE_BRANCH_MANAGER);
        branchMgr.setBranch(branchA);

        UserDto req = new UserDto();
        req.setEmail("m2@pos.vn");
        req.setFullName("M2");
        req.setPassword("123456");
        req.setRole(UserRole.ROLE_CASHIER);

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branchA));
        when(userService.getCurrentUser()).thenReturn(branchMgr);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> employeeService.createBranchEmployee(req, 10L));
        assertTrue(ex.getMessage().contains("Store Owner"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void createBranchEmployee_cashier_savesSuccessfully() throws Exception {
        UserDto req = new UserDto();
        req.setEmail("cashier@pos.vn");
        req.setFullName("Cashier One");
        req.setPassword("123456");
        req.setRole(UserRole.ROLE_CASHIER);

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branchA));
        when(userService.getCurrentUser()).thenReturn(owner);
        when(userRepository.findByEmail("cashier@pos.vn")).thenReturn(null);
        when(passwordEncoder.encode("123456")).thenReturn("$enc");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(300L);
            return u;
        });

        UserDto res = employeeService.createBranchEmployee(req, 10L);

        assertEquals(300L, res.getId());
        assertEquals(10L, res.getBranchId());
    }

    @Test
    void updateEmployee_disablingLoginAccess_closesOpenShiftsAndInvalidatesResetTokensOnPasswordChange() throws Exception {
        User existing = new User();
        existing.setId(77L);
        existing.setEmail("cash@pos.vn");
        existing.setRole(UserRole.ROLE_CASHIER);
        existing.setStore(store);
        existing.setBranch(branchA);
        existing.setLoginAccess(true);

        when(userRepository.findById(77L)).thenReturn(Optional.of(existing));
        when(userService.getCurrentUser()).thenReturn(owner);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(passwordEncoder.encode("newpass123")).thenReturn("$newHash");

        UserDto details = new UserDto();
        details.setPassword("newpass123");
        details.setLoginAccess(false);

        User updated = employeeService.updateEmployee(77L, details);

        assertFalse(updated.getLoginAccess());
        assertNotNull(updated.getPasswordChangedAt());
        verify(passwordResetTokenRepository).invalidateAllActiveTokensByUserId(77L);
        verify(lifecycleService).closeOpenShiftsForEmployee(77L);
        verify(lifecycleService).syncManagedBranchAfterSave(existing, branchA);
    }

    @Test
    void updateEmployee_promotingUnassignedRoleToStoreOwner_clearsBranch() throws Exception {
        User existing = new User();
        existing.setId(78L);
        existing.setEmail("mgr@pos.vn");
        existing.setRole(UserRole.ROLE_BRANCH_MANAGER);
        existing.setStore(store);
        existing.setBranch(branchA);

        when(userRepository.findById(78L)).thenReturn(Optional.of(existing));
        when(userService.getCurrentUser()).thenReturn(owner);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserDto details = new UserDto();
        details.setRole(UserRole.ROLE_STORE_OWNER);

        User updated = employeeService.updateEmployee(78L, details);

        assertNull(updated.getBranch());
        verify(lifecycleService).syncManagedBranchAfterSave(existing, null);
    }

    @Test
    void deleteEmployee_byBranchManager_throwsAccessDenied() throws Exception {
        User branchMgr = new User();
        branchMgr.setId(50L);
        branchMgr.setRole(UserRole.ROLE_BRANCH_MANAGER);
        branchMgr.setBranch(branchA);

        User cashierTarget = new User();
        cashierTarget.setId(88L);
        cashierTarget.setRole(UserRole.ROLE_CASHIER);
        cashierTarget.setBranch(branchA);

        when(userRepository.findById(88L)).thenReturn(Optional.of(cashierTarget));
        when(userService.getCurrentUser()).thenReturn(branchMgr);

        assertThrows(AccessDeniedException.class, () -> employeeService.deleteEmployee(88L));
        verify(lifecycleService, never()).deleteEmployeeWithCleanup(any());
    }

    @Test
    void updateEmployee_branchManagerEditingCashierProfileFields_throwsAccessDenied() throws Exception {
        User branchMgr = new User();
        branchMgr.setId(50L);
        branchMgr.setRole(UserRole.ROLE_BRANCH_MANAGER);
        branchMgr.setBranch(branchA);

        User existingCashier = new User();
        existingCashier.setId(77L);
        existingCashier.setEmail("cash@pos.vn");
        existingCashier.setFullName("Cashier Old");
        existingCashier.setRole(UserRole.ROLE_CASHIER);
        existingCashier.setStore(store);
        existingCashier.setBranch(branchA);

        when(userRepository.findById(77L)).thenReturn(Optional.of(existingCashier));
        when(userService.getCurrentUser()).thenReturn(branchMgr);

        UserDto details = new UserDto();
        details.setFullName("Cashier Renamed");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> employeeService.updateEmployee(77L, details));
        assertTrue(ex.getMessage().contains("login access or reset password"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void updateEmployee_branchManagerTogglesLoginAccessAndResetsPasswordForCashier_succeeds() throws Exception {
        User branchMgr = new User();
        branchMgr.setId(50L);
        branchMgr.setRole(UserRole.ROLE_BRANCH_MANAGER);
        branchMgr.setBranch(branchA);

        User existingCashier = new User();
        existingCashier.setId(77L);
        existingCashier.setEmail("cash@pos.vn");
        existingCashier.setFullName("Cashier One");
        existingCashier.setRole(UserRole.ROLE_CASHIER);
        existingCashier.setStore(store);
        existingCashier.setBranch(branchA);
        existingCashier.setLoginAccess(true);

        when(userRepository.findById(77L)).thenReturn(Optional.of(existingCashier));
        when(userService.getCurrentUser()).thenReturn(branchMgr);
        when(passwordEncoder.encode("temp1234")).thenReturn("$tempHash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserDto details = new UserDto();
        details.setPassword("temp1234");
        details.setLoginAccess(false);

        User updated = employeeService.updateEmployee(77L, details);

        assertFalse(updated.getLoginAccess());
        assertEquals("$tempHash", updated.getPassword());
        verify(passwordResetTokenRepository).invalidateAllActiveTokensByUserId(77L);
        verify(lifecycleService).closeOpenShiftsForEmployee(77L);
    }

    @Test
    void deleteEmployee_delegatesAuthorizationAndCleanup() throws Exception {
        User target = new User();
        target.setId(88L);
        when(userRepository.findById(88L)).thenReturn(Optional.of(target));
        when(userService.getCurrentUser()).thenReturn(owner);

        employeeService.deleteEmployee(88L);

        verify(permissionValidator).authorizeEmployeeMutation(owner, target, true);
        verify(lifecycleService).deleteEmployeeWithCleanup(target);
    }

    @Test
    void findStoreEmployees_filtersByRoleWhenProvided() throws Exception {
        User cashier = new User();
        cashier.setId(1L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        User manager = new User();
        manager.setId(2L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);

        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(userRepository.findByStore(store)).thenReturn(List.of(cashier, manager));

        List<UserDto> cashiers = employeeService.findStoreEmployees(1L, UserRole.ROLE_CASHIER);

        assertEquals(1, cashiers.size());
        assertEquals(1L, cashiers.get(0).getId());
    }
}
