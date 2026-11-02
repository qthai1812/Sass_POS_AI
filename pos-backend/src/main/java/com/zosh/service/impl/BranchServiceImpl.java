package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.BranchMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.BranchDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.BranchService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.UserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BranchServiceImpl implements BranchService {

    private final BranchRepository branchRepository;
    private final StoreRepository storeRepository;
    private final UserService userService;
    private final UserRepository userRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final PlanLimitChecker planLimitChecker;
    private final AccessControlService accessControl;

    private void validateBranchAccess(User user, Branch branch) throws Exception {
        if (user == null || branch == null || branch.getStore() == null) {
            throw new AccessDeniedException("You do not have permission to manage this branch");
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        Store store = branch.getStore();
        boolean isStoreOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isSameStoreManager = user.getStore() != null
                && user.getStore().getId().equals(store.getId())
                && (user.getRole() == UserRole.ROLE_STORE_ADMIN || user.getRole() == UserRole.ROLE_STORE_MANAGER);
        boolean isThisBranchManager = user.getBranch() != null
                && user.getBranch().getId().equals(branch.getId())
                && user.getRole() == UserRole.ROLE_BRANCH_MANAGER;

        if (!isStoreOwner && !isSameStoreManager && !isThisBranchManager) {
            throw new AccessDeniedException("You do not have permission to manage this branch");
        }
    }

    private void validateStoreAdminOrManager(User user, Store store) throws UserException {
        if (user == null || store == null) {
            throw new UserException("You do not have permission to manage branches for this store");
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        boolean isStoreOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isSameStoreManager = user.getStore() != null
                && user.getStore().getId().equals(store.getId())
                && (user.getRole() == UserRole.ROLE_STORE_ADMIN || user.getRole() == UserRole.ROLE_STORE_MANAGER);

        if (!isStoreOwner && !isSameStoreManager) {
            throw new UserException("Only store admin or store manager can create or delete branches");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BranchDTO createBranch(BranchDTO branchDTO) throws UserException {
        User currentUser = userService.getCurrentUser();
        Store store = storeRepository.findByStoreAdminId(currentUser.getId());
        if (store == null && currentUser.getStore() != null) {
            store = currentUser.getStore();
        }
        if (store == null && branchDTO.getStoreId() != null) {
            store = storeRepository.findById(branchDTO.getStoreId()).orElse(null);
        }
        if (store == null) {
            throw new UserException("Store not found for creating branch");
        }
        validateStoreAdminOrManager(currentUser, store);
        planLimitChecker.checkBranchLimit(store);

        Branch branch = BranchMapper.toEntity(branchDTO, store);
        Branch savedBranch = branchRepository.save(branch);
        return BranchMapper.toDTO(savedBranch);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BranchDTO updateBranch(Long id, BranchDTO branchDTO) throws Exception {
        Branch existing = branchRepository.findById(id).orElseThrow(
                () -> new Exception("branch not exist...")
        );
        validateBranchAccess(userService.getCurrentUser(), existing);

        if (branchDTO.getName() != null) {
            existing.setName(branchDTO.getName());
        }
        if (branchDTO.getWorkingDays() != null) {
            existing.setWorkingDays(branchDTO.getWorkingDays());
        }
        if (branchDTO.getEmail() != null) {
            existing.setEmail(branchDTO.getEmail());
        }
        if (branchDTO.getPhone() != null) {
            existing.setPhone(branchDTO.getPhone());
        }
        if (branchDTO.getAddress() != null) {
            existing.setAddress(branchDTO.getAddress());
        }
        if (branchDTO.getOpenTime() != null) {
            existing.setOpenTime(branchDTO.getOpenTime());
        }
        if (branchDTO.getCloseTime() != null) {
            existing.setCloseTime(branchDTO.getCloseTime());
        }
        existing.setUpdatedAt(LocalDateTime.now());

        Branch updatedBranch = branchRepository.save(existing);
        return BranchMapper.toDTO(updatedBranch);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteBranch(Long id) throws Exception {
        Branch existing = branchRepository.findById(id).orElseThrow(
                () -> new Exception("branch not exist...")
        );
        User currentUser = userService.getCurrentUser();
        validateStoreAdminOrManager(currentUser, existing.getStore());

        List<Order> existingOrders = orderRepository.findByBranchId(id);
        if (!existingOrders.isEmpty()) {
            throw new com.zosh.exceptions.UserException(
                "Chi nhánh này đã phát sinh " + existingOrders.size() + 
                " đơn hàng trong lịch sử. Không thể xóa vĩnh viễn để bảo toàn dữ liệu kế toán của cửa hàng."
            );
        }

        // Unlink employees assigned to this branch and suspend login for branch-scoped roles until reassigned
        List<User> branchUsers = userRepository.findByBranchId(id);
        for (User u : branchUsers) {
            u.setBranch(null);
            if (u.getRole() == UserRole.ROLE_BRANCH_CASHIER || u.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
                u.setLoginAccess(false);
            }
            userRepository.save(u);
        }
        existing.setManager(null);
        branchRepository.save(existing);

        // Clean up or unlink refunds, shift reports, orders, and inventory
        List<Refund> branchRefunds = refundRepository.findByBranchId(id);
        for (Refund r : branchRefunds) {
            r.setBranch(null);
            r.setShiftReport(null);
            refundRepository.save(r);
        }

        List<ShiftReport> shiftReports = shiftReportRepository.findByBranchId(id);
        for (ShiftReport sr : shiftReports) {
            List<Refund> srRefunds = refundRepository.findByShiftReportId(sr.getId());
            for (Refund r : srRefunds) {
                r.setShiftReport(null);
                refundRepository.save(r);
            }
            sr.setBranch(null);
            shiftReportRepository.save(sr);
        }
        if (!shiftReports.isEmpty()) {
            shiftReportRepository.deleteAll(shiftReports);
        }

        List<Order> branchOrders = orderRepository.findByBranchId(id);
        for (Order o : branchOrders) {
            o.setBranch(null);
            orderRepository.save(o);
        }

        List<Inventory> branchInventories = inventoryRepository.findByBranchId(id);
        if (!branchInventories.isEmpty()) {
            inventoryRepository.deleteAll(branchInventories);
        }

        branchRepository.delete(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BranchDTO> getAllBranchesByStoreId(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new EntityNotFoundException("Store not found with id: " + storeId));
        try {
            accessControl.assertCanAccessStore(userService.getCurrentUser(), store);
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("You do not have permission to view branches of this store");
        }
        List<Branch> branches = branchRepository.findByStoreId(storeId);
        return branches.stream().map(BranchMapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public BranchDTO getBranchById(Long id) throws Exception {
        Branch existing = branchRepository.findById(id).orElseThrow(
                () -> new Exception("branch not exist...")
        );
        accessControl.assertCanAccessStore(userService.getCurrentUser(), existing.getStore());
        return BranchMapper.toDTO(existing);
    }
}
