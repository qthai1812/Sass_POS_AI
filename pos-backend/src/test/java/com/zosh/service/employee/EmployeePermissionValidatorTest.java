package com.zosh.service.employee;

import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.StoreRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmployeePermissionValidatorTest {

    @Mock private UserService userService;
    @Mock private StoreRepository storeRepository;
    @Mock private AccessControlService accessControl;

    @InjectMocks
    private EmployeePermissionValidator validator;

    @Test
    void validateNewEmployeeFields_rejectsShortPasswordAndMissingRole() {
        UserDto dto = new UserDto();
        dto.setEmail("a@pos.vn");
        dto.setFullName("Staff");
        dto.setPassword("123");

        assertThrows(IllegalArgumentException.class, () -> validator.validateNewEmployeeFields(dto));

        dto.setPassword("123456");
        dto.setRole(null);
        assertThrows(IllegalArgumentException.class, () -> validator.validateNewEmployeeFields(dto));
    }

    @Test
    void checkNotAdminRole_rejectsSuperAdminAndNonOwnerAssigningOwnerRole() throws Exception {
        assertThrows(Exception.class, () -> validator.checkNotAdminRole(UserRole.ROLE_SUPER_ADMIN));

        User branchManager = new User();
        branchManager.setId(5L);
        branchManager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        when(userService.getCurrentUser()).thenReturn(branchManager);

        assertThrows(AccessDeniedException.class, () -> validator.checkNotAdminRole(UserRole.ROLE_STORE_OWNER));
    }

    @Test
    void validateBranchPermission_allowsSameBranchManager() throws Exception {
        Branch branch = Branch.builder().id(10L).build();
        User manager = new User();
        manager.setId(7L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        manager.setBranch(branch);
        when(userService.getCurrentUser()).thenReturn(manager);

        assertDoesNotThrow(() -> validator.validateBranchPermission(branch));
    }

    @Test
    void authorizeEmployeeMutation_blocksSelfDeleteAndSuperAdminDelete() throws Exception {
        User owner = new User();
        owner.setId(1L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        assertThrows(Exception.class, () -> validator.authorizeEmployeeMutation(owner, owner, true));

        User saTarget = new User();
        saTarget.setId(2L);
        saTarget.setRole(UserRole.ROLE_SUPER_ADMIN);
        assertThrows(Exception.class, () -> validator.authorizeEmployeeMutation(owner, saTarget, true));
    }

    @Test
    void authorizeEmployeeMutation_branchManagerCannotDeleteAnotherManager() throws Exception {
        Branch branch = Branch.builder().id(10L).build();
        User currentManager = new User();
        currentManager.setId(5L);
        currentManager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        currentManager.setBranch(branch);

        User otherManager = new User();
        otherManager.setId(6L);
        otherManager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        otherManager.setBranch(branch);

        Exception ex = assertThrows(AccessDeniedException.class,
                () -> validator.authorizeEmployeeMutation(currentManager, otherManager, true));
        assertTrue(ex.getMessage().contains("Store Owner"));
    }

    @Test
    void authorizeEmployeeMutation_branchManagerCannotModifySelfOrManager_allowsSameBranchCashier() throws Exception {
        Branch branch = Branch.builder().id(10L).build();
        User currentManager = new User();
        currentManager.setId(5L);
        currentManager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        currentManager.setBranch(branch);

        User otherManager = new User();
        otherManager.setId(6L);
        otherManager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        otherManager.setBranch(branch);

        User cashier = new User();
        cashier.setId(7L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setBranch(branch);

        when(userService.getCurrentUser()).thenReturn(currentManager);

        assertThrows(AccessDeniedException.class,
                () -> validator.authorizeEmployeeMutation(currentManager, currentManager, false));
        assertThrows(AccessDeniedException.class,
                () -> validator.authorizeEmployeeMutation(currentManager, otherManager, false));
        assertDoesNotThrow(() -> validator.authorizeEmployeeMutation(currentManager, cashier, false));
    }

    @Test
    void assertCanModifyTargetEmployee_blocksCoOwnerModifyingAnotherOwner() {
        User actualOwner = new User();
        actualOwner.setId(1L);
        Store store = new Store();
        store.setId(100L);
        store.setStoreAdmin(actualOwner);

        User peerOwner = new User();
        peerOwner.setId(2L);
        peerOwner.setRole(UserRole.ROLE_STORE_OWNER);
        peerOwner.setStore(store);

        User coOwner = new User();
        coOwner.setId(3L);
        coOwner.setRole(UserRole.ROLE_STORE_OWNER);
        coOwner.setStore(store);

        when(storeRepository.findByStoreAdminId(2L)).thenReturn(null);

        assertThrows(AccessDeniedException.class,
                () -> validator.assertCanModifyTargetEmployee(coOwner, peerOwner));
    }
}
