package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.PasswordResetTokenRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.EmployeeService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import com.zosh.service.employee.EmployeeLifecycleService;
import com.zosh.service.employee.EmployeePermissionValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final BranchRepository branchRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PlanLimitChecker planLimitChecker;
    private final AccessControlService accessControl;
    private final EmployeePermissionValidator permissionValidator;
    private final EmployeeLifecycleService lifecycleService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto createStoreEmployee(UserDto employee, Long storeId) throws Exception {
        permissionValidator.validateNewEmployeeFields(employee);
        Store store = storeRepository.findById(storeId).orElseThrow(
                () -> new Exception("Store not found")
        );
        permissionValidator.validateStorePermission(store);
        permissionValidator.checkNotAdminRole(employee.getRole());
        planLimitChecker.checkUserLimit(store);

        String normalizedEmail = assertUniqueEmail(employee.getEmail(), null);
        Branch branch = resolveStoreEmployeeBranch(employee, store);

        User user = buildNewEmployeeEntity(employee, normalizedEmail, store, branch);
        User savedEmployee = userRepository.save(user);
        lifecycleService.syncManagedBranchAfterSave(savedEmployee, branch);
        return UserMapper.toDTO(savedEmployee, store);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto createBranchEmployee(UserDto employee, Long branchId) throws Exception {
        permissionValidator.validateNewEmployeeFields(employee);
        Branch branch = branchRepository.findById(branchId).orElseThrow(
                () -> new Exception("branch not found")
        );
        permissionValidator.validateBranchPermission(branch);
        permissionValidator.checkNotAdminRole(employee.getRole());

        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_STORE_OWNER) {
            throw new AccessDeniedException("Only Store Owner can create branch employees");
        }

        planLimitChecker.checkUserLimit(branch.getStore());
        String normalizedEmail = assertUniqueEmail(employee.getEmail(), null);

        if (employee.getRole() != UserRole.ROLE_CASHIER && employee.getRole() != UserRole.ROLE_BRANCH_MANAGER) {
            throw new Exception("branch role not supported");
        }

        User user = buildNewEmployeeEntity(employee, normalizedEmail, branch.getStore(), branch);
        User savedEmployee = userRepository.save(user);
        lifecycleService.syncManagedBranchAfterSave(savedEmployee, branch);
        return UserMapper.toDTO(savedEmployee, branch.getStore());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public User updateEmployee(Long employeeId, UserDto employeeDetails) throws Exception {
        User existingEmployee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee doesn't exist with given id")
        );
        User currentUser = userService.getCurrentUser();
        permissionValidator.authorizeEmployeeMutation(currentUser, existingEmployee, false);
        permissionValidator.validateRoleUpdate(currentUser, existingEmployee, employeeDetails.getRole());
        assertBranchManagerScopeOnUpdate(currentUser, existingEmployee, employeeDetails);

        applyEmailUpdate(existingEmployee, employeeDetails.getEmail());
        Branch targetBranch = resolveTargetBranchForUpdate(existingEmployee, employeeDetails);
        applyProfileAndSecurityUpdates(currentUser, existingEmployee, employeeDetails);

        // Nhân viên cấp Cửa hàng (STORE_OWNER) không thuộc chi nhánh nào:
        // khi thăng cấp mà không truyền branchId thì gỡ chi nhánh cũ.
        if (employeeDetails.getBranchId() == null && existingEmployee.getRole() == UserRole.ROLE_STORE_OWNER) {
            targetBranch = null;
        }
        boolean wasUnassignedBranch = existingEmployee.getBranch() == null;
        existingEmployee.setBranch(targetBranch);
        if (wasUnassignedBranch && targetBranch != null && employeeDetails.getLoginAccess() == null) {
            existingEmployee.setLoginAccess(true);
        }

        User saved = userRepository.save(existingEmployee);
        lifecycleService.syncManagedBranchAfterSave(saved, targetBranch);
        return saved;
    }

    private void assertBranchManagerScopeOnUpdate(User currentUser, User existingEmployee, UserDto details) {
        if (currentUser == null || currentUser.getRole() != UserRole.ROLE_BRANCH_MANAGER) {
            return;
        }
        if (currentUser.getId().equals(existingEmployee.getId())) {
            throw new AccessDeniedException("Branch Manager cannot modify their own account");
        }
        if (existingEmployee.getRole() != UserRole.ROLE_CASHIER) {
            throw new AccessDeniedException("Branch Manager can only manage Cashiers");
        }
        boolean editingEmail = details.getEmail() != null && !details.getEmail().trim().isEmpty()
                && !details.getEmail().trim().equalsIgnoreCase(existingEmployee.getEmail());
        boolean editingName = details.getFullName() != null && !details.getFullName().trim().isEmpty()
                && !details.getFullName().trim().equals(existingEmployee.getFullName());
        boolean editingPhone = details.getPhone() != null
                && !Objects.equals(details.getPhone().trim(),
                existingEmployee.getPhone() != null ? existingEmployee.getPhone().trim() : null);
        boolean editingRole = details.getRole() != null && details.getRole() != existingEmployee.getRole();
        boolean editingBranch = details.getBranchId() != null
                && (existingEmployee.getBranch() == null || !details.getBranchId().equals(existingEmployee.getBranch().getId()));
        if (editingEmail || editingName || editingPhone || editingRole || editingBranch) {
            throw new AccessDeniedException("Branch Manager can only toggle login access or reset password for Cashiers");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto updateEmployeeDto(Long employeeId, UserDto employeeDetails) throws Exception {
        return UserMapper.toDTO(updateEmployee(employeeId, employeeDetails));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteEmployee(Long employeeId) throws Exception {
        User employee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee not found")
        );
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_STORE_OWNER) {
            throw new AccessDeniedException("Only Store Owner can delete employees");
        }
        permissionValidator.authorizeEmployeeMutation(currentUser, employee, true);
        lifecycleService.deleteEmployeeWithCleanup(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto findEmployeeById(Long employeeId) throws Exception {
        User employee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee not found with id " + employeeId)
        );
        User currentUser = userService.getCurrentUser();
        if (!currentUser.getId().equals(employee.getId())) {
            if (employee.getBranch() != null) {
                accessControl.assertCanAccessBranch(currentUser, employee.getBranch());
            } else if (employee.getStore() != null) {
                permissionValidator.validateStorePermission(employee.getStore());
            } else {
                throw new Exception("You do not have permission to view this employee");
            }
        }
        return UserMapper.toDTO(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> findStoreEmployees(Long storeId, UserRole role) throws Exception {
        Store store = storeRepository.findById(storeId).orElseThrow(
                () -> new Exception("Store not found")
        );
        permissionValidator.validateStorePermission(store);
        return userRepository.findByStore(store).stream()
                .filter(user -> role == null || user.getRole() == role)
                .map(user -> UserMapper.toDTO(user, store))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> findBranchEmployees(Long branchId, UserRole role) throws Exception {
        Branch branch = branchRepository.findById(branchId).orElseThrow(
                () -> new Exception("branch not found")
        );
        accessControl.assertCanAccessBranch(userService.getCurrentUser(), branch);
        return userRepository.findByBranchId(branchId).stream()
                .filter(user -> role == null || user.getRole() == role)
                .map(user -> UserMapper.toDTO(user, branch.getStore()))
                .collect(Collectors.toList());
    }

    private String assertUniqueEmail(String rawEmail, Long selfUserId) throws Exception {
        String normalizedEmail = rawEmail.trim();
        User duplicate = userRepository.findByEmail(normalizedEmail);
        if (duplicate != null && (selfUserId == null || !duplicate.getId().equals(selfUserId))) {
            throw new Exception(selfUserId == null
                    ? "Email already registered: " + normalizedEmail
                    : "Email already in use by another account");
        }
        return normalizedEmail;
    }

    private Branch resolveStoreEmployeeBranch(UserDto employee, Store store) throws Exception {
        if (employee.getRole() != UserRole.ROLE_BRANCH_MANAGER
                && employee.getRole() != UserRole.ROLE_CASHIER
                && employee.getBranchId() == null) {
            return null;
        }
        if (employee.getBranchId() == null && employee.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            throw new Exception("branch id is required to create branch manager");
        }
        if (employee.getBranchId() == null) {
            return null;
        }
        Branch branch = branchRepository.findById(employee.getBranchId()).orElseThrow(
                () -> new Exception("branch not found")
        );
        if (branch.getStore() != null && !branch.getStore().getId().equals(store.getId())) {
            throw new Exception("Branch does not belong to this store");
        }
        return branch;
    }

    private User buildNewEmployeeEntity(UserDto dto, String normalizedEmail, Store store, Branch branch) {
        User user = UserMapper.toEntity(dto);
        user.setEmail(normalizedEmail);
        user.setFullName(dto.getFullName().trim());
        user.setStore(store);
        user.setBranch(branch);
        user.setPassword(passwordEncoder.encode(dto.getPassword().trim()));
        return user;
    }

    private void applyEmailUpdate(User existingEmployee, String rawEmail) throws Exception {
        if (rawEmail != null && !rawEmail.trim().isEmpty()
                && !rawEmail.trim().equalsIgnoreCase(existingEmployee.getEmail())) {
            String trimmedEmail = assertUniqueEmail(rawEmail, existingEmployee.getId());
            existingEmployee.setEmail(trimmedEmail);
        }
    }

    private Branch resolveTargetBranchForUpdate(User existingEmployee, UserDto details) throws Exception {
        Branch branch = existingEmployee.getBranch();
        if (details.getBranchId() != null) {
            branch = branchRepository.findById(details.getBranchId()).orElseThrow(
                    () -> new Exception("branch not found")
            );
            // Không cho chuyển nhân viên sang chi nhánh của cửa hàng khác (cách ly dữ liệu multi-tenant)
            Store employeeStore = existingEmployee.getStore();
            if (employeeStore != null && branch.getStore() != null
                    && !employeeStore.getId().equals(branch.getStore().getId())) {
                throw new Exception("Branch does not belong to the employee's store");
            }
            permissionValidator.validateBranchPermission(branch);
            if (employeeStore == null) {
                existingEmployee.setStore(branch.getStore());
            }
        }
        return branch;
    }

    private void applyProfileAndSecurityUpdates(User currentUser, User existingEmployee, UserDto details) throws Exception {
        if (details.getFullName() != null && !details.getFullName().trim().isEmpty()) {
            existingEmployee.setFullName(details.getFullName().trim());
        }
        if (details.getPhone() != null) {
            existingEmployee.setPhone(details.getPhone().trim());
        }
        if (details.getPassword() != null && !details.getPassword().trim().isEmpty()) {
            if (details.getPassword().trim().length() < 6) {
                throw new IllegalArgumentException("Password must be at least 6 characters");
            }
            existingEmployee.setPassword(passwordEncoder.encode(details.getPassword().trim()));
            existingEmployee.setPasswordChangedAt(LocalDateTime.now());
            passwordResetTokenRepository.invalidateAllActiveTokensByUserId(existingEmployee.getId());
        }
        if (details.getRole() != null) {
            existingEmployee.setRole(details.getRole());
        }
        if (details.getLoginAccess() != null) {
            if (Boolean.FALSE.equals(details.getLoginAccess())) {
                if (currentUser != null && currentUser.getId().equals(existingEmployee.getId())) {
                    throw new Exception("You cannot disable your own login access");
                }
                if (currentUser != null
                        && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                        && existingEmployee.getRole() != UserRole.ROLE_CASHIER) {
                    throw new Exception("Branch Manager can only disable login access for Cashiers");
                }
                lifecycleService.closeOpenShiftsForEmployee(existingEmployee.getId());
            }
            existingEmployee.setLoginAccess(details.getLoginAccess());
        }
    }
}
