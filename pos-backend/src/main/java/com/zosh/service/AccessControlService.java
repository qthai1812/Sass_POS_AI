package com.zosh.service;

import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Kiểm tra quyền truy cập theo mô hình multi-tenant: Store -> Branch -> Employee.
 * Dùng chung cho các service nghiệp vụ để tránh việc user của cửa hàng/chi nhánh này
 * đọc hoặc sửa dữ liệu của cửa hàng/chi nhánh khác.
 */
@Component
@RequiredArgsConstructor
public class AccessControlService {

    private final UserService userService;
    private final StoreRepository storeRepository;

    public User currentUser() throws Exception {
        return userService.getCurrentUser();
    }

    /** Trả về Store mà user hiện tại trực thuộc (hoặc làm chủ sở hữu). */
    public Store resolveStoreOfUser(User user) {
        if (user == null) {
            return null;
        }
        if (user.getStore() != null) {
            return user.getStore();
        }
        if (user.getBranch() != null && user.getBranch().getStore() != null) {
            return user.getBranch().getStore();
        }
        return storeRepository.findByStoreAdminId(user.getId());
    }

    /** User là chủ cửa hàng hoặc STORE_ADMIN / STORE_MANAGER thuộc cửa hàng đó. */
    public boolean isStoreLevelUser(User user, Store store) {
        if (user == null || store == null) {
            return false;
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return true;
        }
        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isStoreStaff = user.getStore() != null
                && user.getStore().getId().equals(store.getId())
                && (user.getRole() == UserRole.ROLE_STORE_ADMIN || user.getRole() == UserRole.ROLE_STORE_MANAGER);
        return isOwner || isStoreStaff;
    }

    /** Quyền đọc cấp Store (bao gồm cả Branch Manager và Cashier thuộc chi nhánh của Store đó). */
    public boolean canAccessStore(User user, Store store) {
        if (user == null || store == null) {
            return false;
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return true;
        }
        if (isStoreLevelUser(user, store)) {
            return true;
        }
        if (user.getStore() != null && user.getStore().getId().equals(store.getId())) {
            return true;
        }
        return user.getBranch() != null
                && user.getBranch().getStore() != null
                && user.getBranch().getStore().getId().equals(store.getId());
    }

    public void assertCanAccessStore(User user, Store store) {
        if (!canAccessStore(user, store)) {
            throw new AccessDeniedException("You do not have permission to access resources of this store");
        }
    }

    /** Quyền quản lý (sửa/xóa/hủy): Admin, cấp cửa hàng, hoặc BRANCH_MANAGER của chính chi nhánh đó. */
    public boolean canManageBranch(User user, Branch branch) {
        if (user == null || branch == null) {
            return false;
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return true;
        }
        if (isStoreLevelUser(user, branch.getStore())) {
            return true;
        }
        return user.getRole() == UserRole.ROLE_BRANCH_MANAGER
                && user.getBranch() != null
                && user.getBranch().getId().equals(branch.getId());
    }

    /** Quyền thao tác/xem: như quyền quản lý, cộng thêm nhân viên (thu ngân) thuộc chi nhánh. */
    public boolean canAccessBranch(User user, Branch branch) {
        if (canManageBranch(user, branch)) {
            return true;
        }
        return user != null
                && branch != null
                && user.getBranch() != null
                && user.getBranch().getId().equals(branch.getId());
    }

    public void assertCanAccessBranch(User user, Branch branch) throws Exception {
        if (!canAccessBranch(user, branch)) {
            throw new AccessDeniedException("You do not have permission to access this branch");
        }
    }

    public void assertCanManageBranch(User user, Branch branch) throws Exception {
        if (!canManageBranch(user, branch)) {
            throw new AccessDeniedException("You do not have permission to manage this branch");
        }
    }
}
