package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.EmployeeService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
    private final OrderRepository orderRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final RefundRepository refundRepository;
    private final PlanLimitChecker planLimitChecker;
    private final AccessControlService accessControl;

    private void validateStorePermission(Store store) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() == UserRole.ROLE_ADMIN) return;
        if (store == null) {
            throw new Exception("You do not have permission to manage employees in this store");
        }

        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(currentUser.getId());
        boolean isSameStoreManager = currentUser.getStore() != null
                && currentUser.getStore().getId().equals(store.getId())
                && (currentUser.getRole() == UserRole.ROLE_STORE_ADMIN || currentUser.getRole() == UserRole.ROLE_STORE_MANAGER);

        if (!isOwner && !isSameStoreManager) {
            throw new Exception("You do not have permission to manage employees in this store");
        }
    }

    private void validateBranchPermission(Branch branch) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() == UserRole.ROLE_ADMIN) return;
        if (branch == null) {
            throw new Exception("You do not have permission to manage employees in this branch");
        }

        boolean isBranchManager = currentUser.getBranch() != null
                && currentUser.getBranch().getId().equals(branch.getId())
                && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER;

        if (!isBranchManager) {
            validateStorePermission(branch.getStore());
        }
    }

    private void checkNotAdminRole(UserRole role) throws Exception {
        if (role == UserRole.ROLE_ADMIN) {
            throw new Exception("Cannot assign ROLE_ADMIN privilege to an employee");
        }
        User currentUser = userService.getCurrentUser();
        if (currentUser != null
                && currentUser.getRole() != UserRole.ROLE_ADMIN
                && currentUser.getRole() != UserRole.ROLE_STORE_ADMIN
                && role == UserRole.ROLE_STORE_ADMIN) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Only Store Owner (ROLE_STORE_ADMIN) or Super Admin can assign ROLE_STORE_ADMIN"
            );
        }
    }

    private void assertCanModifyTargetEmployee(User currentUser, User targetEmployee) throws Exception {
        if (currentUser == null || targetEmployee == null) {
            return;
        }
        if (currentUser.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        Store ownedStore = storeRepository.findByStoreAdminId(targetEmployee.getId());
        boolean isTargetStoreOwner = ownedStore != null || targetEmployee.getRole() == UserRole.ROLE_STORE_ADMIN;
        if (isTargetStoreOwner && !currentUser.getId().equals(targetEmployee.getId())) {
            boolean isCurrentActualOwner = targetEmployee.getStore() != null
                    && targetEmployee.getStore().getStoreAdmin() != null
                    && targetEmployee.getStore().getStoreAdmin().getId().equals(currentUser.getId());
            if (!isCurrentActualOwner) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Store Manager does not have permission to modify or delete a Store Admin/Owner account"
                );
            }
        }
    }

    private void validateNewEmployeeFields(UserDto employee) throws Exception {
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

    private void clearPreviousManagedBranches(Long userId, Long keepBranchId) {
        List<Branch> managed = branchRepository.findByManagerId(userId);
        for (Branch b : managed) {
            if (keepBranchId == null || !b.getId().equals(keepBranchId)) {
                b.setManager(null);
                branchRepository.save(b);
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto createStoreEmployee(UserDto employee, Long storeId) throws Exception {
        validateNewEmployeeFields(employee);
        Store store = storeRepository.findById(storeId).orElseThrow(
                () -> new Exception("Store not found")
        );
        validateStorePermission(store);
        checkNotAdminRole(employee.getRole());
        planLimitChecker.checkUserLimit(store);

        String normalizedEmail = employee.getEmail().trim();
        if (userRepository.findByEmail(normalizedEmail) != null) {
            throw new Exception("Email already registered: " + normalizedEmail);
        }

        Branch branch = null;
        if (employee.getRole() == UserRole.ROLE_BRANCH_MANAGER
                || employee.getRole() == UserRole.ROLE_BRANCH_CASHIER
                || employee.getBranchId() != null) {
            if (employee.getBranchId() == null && employee.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
                throw new Exception("branch id is required to create branch manager");
            }
            if (employee.getBranchId() != null) {
                branch = branchRepository.findById(employee.getBranchId()).orElseThrow(
                        () -> new Exception("branch not found")
                );
                if (branch.getStore() != null && !branch.getStore().getId().equals(store.getId())) {
                    throw new Exception("Branch does not belong to this store");
                }
            }
        }

        User user = UserMapper.toEntity(employee);
        user.setEmail(normalizedEmail);
        user.setFullName(employee.getFullName().trim());
        user.setStore(store);
        user.setBranch(branch);
        user.setPassword(passwordEncoder.encode(employee.getPassword().trim()));

        User savedEmployee = userRepository.save(user);
        if (employee.getRole() == UserRole.ROLE_BRANCH_MANAGER && branch != null) {
            clearPreviousManagedBranches(savedEmployee.getId(), branch.getId());
            branch.setManager(savedEmployee);
            branchRepository.save(branch);
        }
        return UserMapper.toDTO(savedEmployee, store);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto createBranchEmployee(UserDto employee, Long branchId) throws Exception {
        validateNewEmployeeFields(employee);
        Branch branch = branchRepository.findById(branchId).orElseThrow(
                () -> new Exception("branch not found")
        );
        validateBranchPermission(branch);
        checkNotAdminRole(employee.getRole());

        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                && employee.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
            throw new Exception("Branch Manager does not have permission to assign role " + employee.getRole());
        }

        planLimitChecker.checkUserLimit(branch.getStore());

        String normalizedEmail = employee.getEmail().trim();
        if (userRepository.findByEmail(normalizedEmail) != null) {
            throw new Exception("Email already registered: " + normalizedEmail);
        }

        if (employee.getRole() == UserRole.ROLE_BRANCH_CASHIER ||
                employee.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            User user = UserMapper.toEntity(employee);
            user.setEmail(normalizedEmail);
            user.setFullName(employee.getFullName().trim());
            user.setBranch(branch);
            user.setStore(branch.getStore());
            user.setPassword(passwordEncoder.encode(employee.getPassword().trim()));
            User savedEmployee = userRepository.save(user);

            if (employee.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
                clearPreviousManagedBranches(savedEmployee.getId(), branch.getId());
                branch.setManager(savedEmployee);
                branchRepository.save(branch);
            }
            return UserMapper.toDTO(savedEmployee, branch.getStore());
        }
        throw new Exception("branch role not supported");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public User updateEmployee(Long employeeId, UserDto employeeDetails) throws Exception {
        User existingEmployee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee doesn't exist with given id")
        );
        User currentUser = userService.getCurrentUser();
        assertCanModifyTargetEmployee(currentUser, existingEmployee);

        if (existingEmployee.getRole() == UserRole.ROLE_ADMIN) {
            if (currentUser.getRole() != UserRole.ROLE_ADMIN) {
                throw new Exception("You do not have permission to modify a Super Admin account");
            }
        } else if (existingEmployee.getBranch() != null) {
            validateBranchPermission(existingEmployee.getBranch());
        } else if (existingEmployee.getStore() != null) {
            validateStorePermission(existingEmployee.getStore());
        } else {
            Store ownedStore = storeRepository.findByStoreAdminId(existingEmployee.getId());
            if (ownedStore != null) {
                validateStorePermission(ownedStore);
            } else if (currentUser.getRole() != UserRole.ROLE_ADMIN) {
                throw new Exception("You do not have permission to modify this account");
            }
        }

        if (employeeDetails.getRole() != null) {
            checkNotAdminRole(employeeDetails.getRole());
            if (currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
                boolean keepingSelfRole = currentUser.getId().equals(existingEmployee.getId())
                        && employeeDetails.getRole() == existingEmployee.getRole();
                if (!keepingSelfRole && employeeDetails.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
                    throw new Exception("Branch Manager does not have permission to assign role " + employeeDetails.getRole());
                }
                if (!currentUser.getId().equals(existingEmployee.getId())
                        && existingEmployee.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
                    throw new Exception("Branch Manager does not have permission to modify another manager's account");
                }
            }
        } else if (currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                && !currentUser.getId().equals(existingEmployee.getId())
                && existingEmployee.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
            throw new Exception("Branch Manager does not have permission to modify another manager's account");
        }

        if (employeeDetails.getEmail() != null && !employeeDetails.getEmail().trim().isEmpty()
                && !employeeDetails.getEmail().trim().equalsIgnoreCase(existingEmployee.getEmail())) {
            String trimmedEmail = employeeDetails.getEmail().trim();
            User duplicate = userRepository.findByEmail(trimmedEmail);
            if (duplicate != null && !duplicate.getId().equals(existingEmployee.getId())) {
                throw new Exception("Email already in use by another account");
            }
            existingEmployee.setEmail(trimmedEmail);
        }

        Branch branch = existingEmployee.getBranch();
        if (employeeDetails.getBranchId() != null) {
            branch = branchRepository.findById(employeeDetails.getBranchId()).orElseThrow(
                    () -> new Exception("branch not found")
            );
            // Không cho chuyển nhân viên sang chi nhánh của cửa hàng khác (cách ly dữ liệu multi-tenant)
            Store employeeStore = existingEmployee.getStore();
            if (employeeStore != null && branch.getStore() != null
                    && !employeeStore.getId().equals(branch.getStore().getId())) {
                throw new Exception("Branch does not belong to the employee's store");
            }
            validateBranchPermission(branch);
            if (employeeStore == null) {
                existingEmployee.setStore(branch.getStore());
            }
        }

        if (employeeDetails.getFullName() != null && !employeeDetails.getFullName().trim().isEmpty()) {
            existingEmployee.setFullName(employeeDetails.getFullName().trim());
        }
        if (employeeDetails.getPhone() != null) {
            existingEmployee.setPhone(employeeDetails.getPhone().trim());
        }
        if (employeeDetails.getPassword() != null && !employeeDetails.getPassword().trim().isEmpty()) {
            if (employeeDetails.getPassword().trim().length() < 6) {
                throw new IllegalArgumentException("Password must be at least 6 characters");
            }
            existingEmployee.setPassword(passwordEncoder.encode(employeeDetails.getPassword().trim()));
        }
        if (employeeDetails.getRole() != null) {
            existingEmployee.setRole(employeeDetails.getRole());
        }
        if (employeeDetails.getLoginAccess() != null) {
            if (Boolean.FALSE.equals(employeeDetails.getLoginAccess())) {
                if (currentUser != null && currentUser.getId().equals(existingEmployee.getId())) {
                    throw new Exception("You cannot disable your own login access");
                }
                if (currentUser != null
                        && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                        && existingEmployee.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
                    throw new Exception("Branch Manager can only disable login access for Branch Cashiers");
                }
            }
            existingEmployee.setLoginAccess(employeeDetails.getLoginAccess());
        }
        // Nhân viên cấp Cửa hàng (STORE_MANAGER / STORE_ADMIN) không thuộc chi nhánh nào:
        // khi thăng cấp mà không truyền branchId thì gỡ chi nhánh cũ.
        if (employeeDetails.getBranchId() == null
                && (existingEmployee.getRole() == UserRole.ROLE_STORE_MANAGER
                || existingEmployee.getRole() == UserRole.ROLE_STORE_ADMIN)) {
            branch = null;
        }
        boolean wasUnassignedBranch = existingEmployee.getBranch() == null;
        existingEmployee.setBranch(branch);
        if (wasUnassignedBranch && branch != null && employeeDetails.getLoginAccess() == null) {
            existingEmployee.setLoginAccess(true);
        }

        User saved = userRepository.save(existingEmployee);
        if (saved.getRole() == UserRole.ROLE_BRANCH_MANAGER && branch != null) {
            clearPreviousManagedBranches(saved.getId(), branch.getId());
            branch.setManager(saved);
            branchRepository.save(branch);
        } else {
            clearPreviousManagedBranches(saved.getId(), null);
        }
        return saved;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto updateEmployeeDto(Long employeeId, UserDto employeeDetails) throws Exception {
        User saved = updateEmployee(employeeId, employeeDetails);
        return UserMapper.toDTO(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteEmployee(Long employeeId) throws Exception {
        User employee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee not found")
        );
        User currentUser = userService.getCurrentUser();
        assertCanModifyTargetEmployee(currentUser, employee);
        if (currentUser != null && currentUser.getId().equals(employee.getId())) {
            throw new Exception("You cannot delete your own account");
        }
        if (employee.getRole() == UserRole.ROLE_ADMIN) {
            throw new Exception("You do not have permission to delete a Super Admin account");
        }
        if (employee.getBranch() != null) {
            validateBranchPermission(employee.getBranch());
            if (currentUser != null
                    && currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                    && employee.getRole() != UserRole.ROLE_BRANCH_CASHIER) {
                throw new Exception("Branch Manager can only delete Branch Cashiers");
            }
        } else if (employee.getStore() != null) {
            validateStorePermission(employee.getStore());
        } else {
            Store ownedStore = storeRepository.findByStoreAdminId(employee.getId());
            if (ownedStore != null) {
                validateStorePermission(ownedStore);
            } else if (currentUser == null || currentUser.getRole() != UserRole.ROLE_ADMIN) {
                throw new Exception("You do not have permission to delete this account");
            }
        }

        // Gỡ liên kết manager trong bảng Branch trước khi xóa để tránh lỗi khóa ngoại
        clearPreviousManagedBranches(employee.getId(), null);

        // Xóa PasswordResetToken nếu có
        passwordResetTokenRepository.deleteByUserId(employee.getId());

        // Gỡ liên kết cashier trên Order, ShiftReport, Refund để tránh lỗi khóa ngoại
        List<Order> cashierOrders = orderRepository.findByCashierId(employee.getId());
        for (Order o : cashierOrders) {
            o.setCashier(null);
            orderRepository.save(o);
        }

        List<ShiftReport> cashierShifts = shiftReportRepository.findByCashierId(employee.getId());
        for (ShiftReport sr : cashierShifts) {
            sr.setCashier(null);
            shiftReportRepository.save(sr);
        }

        List<Refund> cashierRefunds = refundRepository.findByCashierId(employee.getId());
        for (Refund r : cashierRefunds) {
            r.setCashier(null);
            refundRepository.save(r);
        }

        userRepository.delete(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto findEmployeeById(Long employeeId) throws Exception {
        User employee = userRepository.findById(employeeId).orElseThrow(
                () -> new Exception("employee not found with id " + employeeId)
        );
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_ADMIN && !currentUser.getId().equals(employee.getId())) {
            if (employee.getBranch() != null) {
                accessControl.assertCanAccessBranch(currentUser, employee.getBranch());
            } else if (employee.getStore() != null) {
                validateStorePermission(employee.getStore());
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
        validateStorePermission(store);
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
}
