package com.zosh.service.employee;

import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.StoreRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Xác thực dữ liệu đầu vào và kiểm tra phân quyền thao tác trên nhân sự theo Store / Branch / Role.
 */
@Component
@RequiredArgsConstructor
public class EmployeePermissionValidator {

    private final UserService userService;
    private final StoreRepository storeRepository;
    private final AccessControlService accessControl;

    public void validateNewEmployeeFields(UserDto employee) {
        if (employee == null) {
            throw new IllegalArgumentException("Employee details are required");
        }
        if (employee.getEmail() == null || employee.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Employee email is required");
        }
        if (employee.getFullName() == null || employee.getFullName().trim().isEmpty()) {
            throw new IllegalArgumentException("Employee full name is required");
        }
        if (employee.getPassword() == null || employee.getPassword().trim().length() < 6) {
            throw new IllegalArgumentException("Employee password must be at least 6 characters");
        }
        if (employee.getRole() == null) {
            throw new IllegalArgumentException("Employee role is required");
        }
    }

    public void validateStorePermission(Store store) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (store == null || !accessControl.isStoreLevelUser(currentUser, store)) {
            throw new AccessDeniedException("You do not have permission to manage employees in this store");
        }
    }

    public void validateBranchPermission(Branch branch) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (branch == null) {
            throw new AccessDeniedException("You do not have permission to manage employees in this branch");
        }
        boolean isBranchManager = currentUser.getBranch() != null
                && currentUser.getBranch().getId().equals(branch.getId())
                && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER;
        if (!isBranchManager) {
            validateStorePermission(branch.getStore());
        }
    }

    public void checkNotAdminRole(UserRole role) throws Exception {
        if (role == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Cannot assign ROLE_SUPER_ADMIN privilege to an employee");
        }
        User currentUser = userService.getCurrentUser();
        if (currentUser != null
                && currentUser.getRole() != UserRole.ROLE_STORE_OWNER
                && role == UserRole.ROLE_STORE_OWNER) {
            throw new AccessDeniedException(
                    "Only Store Owner (ROLE_STORE_OWNER) can assign ROLE_STORE_OWNER"
            );
        }
    }

    public void assertCanModifyTargetEmployee(User currentUser, User targetEmployee) {
        if (currentUser == null || targetEmployee == null) {
            return;
        }
        Store ownedStore = storeRepository.findByStoreAdminId(targetEmployee.getId());
        boolean isTargetStoreOwner = ownedStore != null || targetEmployee.getRole() == UserRole.ROLE_STORE_OWNER;
        if (isTargetStoreOwner && !currentUser.getId().equals(targetEmployee.getId())) {
            boolean isCurrentActualOwner = targetEmployee.getStore() != null
                    && targetEmployee.getStore().getStoreAdmin() != null
                    && targetEmployee.getStore().getStoreAdmin().getId().equals(currentUser.getId());
            if (!isCurrentActualOwner) {
                throw new AccessDeniedException(
                        "You do not have permission to modify or delete a Store Owner account"
                );
            }
        }
    }

    public void authorizeEmployeeMutation(User currentUser, User targetEmployee, boolean forDelete) throws Exception {
        if (targetEmployee.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException(forDelete
                    ? "You do not have permission to delete a Super Admin account"
                    : "You do not have permission to modify a Super Admin account");
        }
        if (forDelete) {
            if (currentUser != null && currentUser.getId().equals(targetEmployee.getId())) {
                throw new AccessDeniedException("You cannot delete your own account");
            }
            if (currentUser == null || currentUser.getRole() != UserRole.ROLE_STORE_OWNER) {
                throw new AccessDeniedException("Only Store Owner can delete employees");
            }
        }
        assertCanModifyTargetEmployee(currentUser, targetEmployee);
        if (currentUser != null && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            if (currentUser.getId().equals(targetEmployee.getId())) {
                throw new AccessDeniedException("Branch Manager cannot modify their own account");
            }
            if (targetEmployee.getRole() != UserRole.ROLE_CASHIER) {
                throw new AccessDeniedException("Branch Manager can only manage Cashiers");
            }
        }
        if (targetEmployee.getBranch() != null) {
            validateBranchPermission(targetEmployee.getBranch());
        } else if (targetEmployee.getStore() != null) {
            validateStorePermission(targetEmployee.getStore());
        } else {
            Store ownedStore = storeRepository.findByStoreAdminId(targetEmployee.getId());
            if (ownedStore != null) {
                validateStorePermission(ownedStore);
            } else {
                throw new AccessDeniedException(forDelete
                        ? "You do not have permission to delete this account"
                        : "You do not have permission to modify this account");
            }
        }
    }

    public void validateRoleUpdate(User currentUser, User existingEmployee, UserRole requestedRole) throws Exception {
        if (currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            if (currentUser.getId().equals(existingEmployee.getId())) {
                throw new AccessDeniedException("Branch Manager cannot modify their own account");
            }
            if (existingEmployee.getRole() != UserRole.ROLE_CASHIER) {
                throw new AccessDeniedException("Branch Manager does not have permission to modify another manager's account");
            }
            if (requestedRole != null && requestedRole != UserRole.ROLE_CASHIER) {
                throw new AccessDeniedException("Branch Manager does not have permission to assign role " + requestedRole);
            }
        }
        if (requestedRole != null) {
            checkNotAdminRole(requestedRole);
        }
    }
}
