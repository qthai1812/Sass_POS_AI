package com.zosh.service.impl;

import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.StoreMapper;
import com.zosh.modal.ShiftReport;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.payload.dto.StoreSummaryDTO;
import com.zosh.payload.response.PageResponse;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.ShiftReportService;
import com.zosh.service.StoreService;
import com.zosh.service.UserService;
import com.zosh.service.store.StoreCascadeDeletionService;
import com.zosh.service.store.StoreRevenueEnricher;
import com.zosh.util.PaginationUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StoreServiceImpl implements StoreService {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "id", "brand", "status", "commissionRate", "createdAt", "updatedAt"
    );

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final UserService userService;
    private final ShiftReportService shiftReportService;
    private final StoreRevenueEnricher storeRevenueEnricher;
    private final StoreCascadeDeletionService cascadeDeletionService;

    private Store resolveStoreForUser(User user) {
        if (user == null) {
            return null;
        }
        Store store = storeRepository.findByStoreAdminId(user.getId());
        if (store == null && user.getStore() != null) {
            store = user.getStore();
        }
        if (store == null && user.getBranch() != null) {
            store = user.getBranch().getStore();
        }
        return store;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO createStore(StoreDTO storeDTO, User user) {
        if (user == null || (user.getRole() != UserRole.ROLE_STORE_OWNER && user.getRole() != UserRole.ROLE_SUPER_ADMIN)) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng (STORE_OWNER) hoặc Quản trị viên mới được phép khởi tạo cửa hàng mới.");
        }
        Store existing = storeRepository.findByStoreAdminId(user.getId());
        if (existing == null && user.getStore() != null) {
            existing = user.getStore();
        }
        if (existing != null) {
            return storeRevenueEnricher.toEnrichedDTO(existing);
        }
        Store savedStore = storeRepository.save(StoreMapper.toEntity(storeDTO, user));

        // Liên kết ngược Store vào User để phân quyền đồng nhất ở mọi luồng
        user.setStore(savedStore);
        userRepository.save(user);

        return storeRevenueEnricher.enrich(StoreMapper.toDTO(savedStore), 0.0);
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreById(Long id) throws Exception {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        Store store = storeRepository.findById(id).orElseThrow(
                () -> new Exception("store not found...")
        );
        if (currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            Store userStore = resolveStoreForUser(currentUser);
            if (userStore == null || !userStore.getId().equals(store.getId())) {
                throw new AccessDeniedException("You do not have permission to access this store");
            }
        }
        return storeRevenueEnricher.toEnrichedDTO(store);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoreDTO> getAllStores(StoreStatus status) {
        User currentUser;
        try {
            currentUser = userService.getCurrentUser();
        } catch (UserException e) {
            return Collections.emptyList();
        }

        List<Store> stores;
        if (currentUser.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            stores = (status != null)
                    ? storeRepository.findByStatus(status)
                    : storeRepository.findAll();
        } else {
            Store ownStore = resolveStoreForUser(currentUser);
            if (ownStore == null || (status != null && ownStore.getStatus() != status)) {
                return Collections.emptyList();
            }
            stores = Collections.singletonList(ownStore);
        }

        return storeRevenueEnricher.toEnrichedDTOList(stores);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StoreDTO> getAllStoresPaged(
            StoreStatus status,
            String keyword,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Only Super Admin can list all stores with pagination");
        }
        Pageable pageable = PaginationUtils.buildPageable(
                page, size, sortBy, sortDir, ALLOWED_SORT_FIELDS, "createdAt"
        );
        String cleanKeyword = keyword != null ? keyword.trim() : "";
        Page<Store> storePage = storeRepository.findStoresPaged(status, cleanKeyword, pageable);
        List<StoreDTO> enriched = storePage.getContent().isEmpty()
                ? Collections.emptyList()
                : storeRevenueEnricher.toEnrichedDTOList(storePage.getContent());
        return PageResponse.of(storePage, enriched);
    }

    @Override
    @Transactional(readOnly = true)
    public StoreSummaryDTO getStoreSummary() throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Only Super Admin can access store platform summary");
        }
        long totalStores = storeRepository.count();
        long activeStores = safeCount(storeRepository.countByStatus(StoreStatus.ACTIVE));
        long pendingStores = safeCount(storeRepository.countByStatus(StoreStatus.PENDING));
        long blockedStores = safeCount(storeRepository.countByStatus(StoreStatus.BLOCKED));
        long rejectedStores = safeCount(storeRepository.countByStatus(StoreStatus.REJECTED));
        Double avgRate = storeRepository.findAverageCommissionRate();
        double roundedAvg = avgRate != null ? Math.round(avgRate * 10.0) / 10.0 : 0.0;
        double totalEarnings = storeRevenueEnricher.computeTotalPlatformEarnings(
                storeRepository.findAllIdAndCommissionRate()
        );
        return StoreSummaryDTO.builder()
                .totalStores(totalStores)
                .activeStores(activeStores)
                .pendingStores(pendingStores)
                .blockedStores(blockedStores)
                .rejectedStores(rejectedStores)
                .averageCommissionRate(roundedAvg)
                .totalEarnings(totalEarnings)
                .build();
    }

    private long safeCount(Long val) {
        return val != null ? val : 0L;
    }

    @Override
    @Transactional(readOnly = true)
    public Store getStoreByAdmin() throws UserException {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        Store store = storeRepository.findByStoreAdminId(currentUser.getId());
        if (store == null && currentUser.getStore() != null
                && (currentUser.getRole() == UserRole.ROLE_STORE_OWNER
                || currentUser.getRole() == UserRole.ROLE_SUPER_ADMIN)) {
            store = currentUser.getStore();
        }
        return store;
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreDtoByAdmin() throws UserException {
        Store store = getStoreByAdmin();
        return storeRevenueEnricher.toEnrichedDTO(store);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO updateStore(Long id, StoreDTO storeDTO) throws Exception {
        User currentUser = userService.getCurrentUser();
        Store existing = resolveEditableStore(id, currentUser);
        if (existing == null) {
            throw new Exception("store not found");
        }
        boolean isSuperAdmin = currentUser.getRole() == UserRole.ROLE_SUPER_ADMIN;
        if (id != null && !existing.getId().equals(id) && !isSuperAdmin) {
            throw new AccessDeniedException("You do not have permission to update this store");
        }

        StoreMapper.applyUpdates(existing, storeDTO, isSuperAdmin);
        Store updatedStore = storeRepository.save(existing);
        return storeRevenueEnricher.toEnrichedDTO(updatedStore);
    }

    private Store resolveEditableStore(Long id, User currentUser) throws UserException {
        Store existing = null;
        if (currentUser.getRole() == UserRole.ROLE_SUPER_ADMIN && id != null) {
            existing = storeRepository.findById(id).orElse(null);
        }
        if (existing == null) {
            existing = getStoreByAdmin();
        }
        if (existing == null && id != null) {
            Store candidate = storeRepository.findById(id).orElse(null);
            if (candidate != null && currentUser.getStore() != null
                    && candidate.getId().equals(currentUser.getStore().getId())
                    && currentUser.getRole() == UserRole.ROLE_STORE_OWNER) {
                existing = candidate;
            }
        }
        return existing;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteStore(Long id) throws UserException {
        User currentUser = userService.getCurrentUser();
        Store store;
        if (id != null) {
            store = storeRepository.findById(id).orElseThrow(
                    () -> new UserException("Store not found with id: " + id)
            );
        } else {
            store = getStoreByAdmin();
            if (store == null) {
                throw new UserException("Store not found");
            }
        }
        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(currentUser.getId());
        if (currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN && !isOwner) {
            throw new UserException("You do not have permission to delete this store");
        }

        cascadeDeletionService.deleteStoreCascade(store);
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreByEmployee() throws UserException {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        if (currentUser == null) {
            throw new UserException("you don't have permission to access this store");
        }
        Store store = resolveStoreForUser(currentUser);
        return storeRevenueEnricher.toEnrichedDTO(store);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO moderateStore(Long id, StoreStatus status) throws Exception {
        return moderateStore(id, status, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO moderateStore(Long id, StoreStatus status, String reason) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin privilege is required to moderate stores");
        }
        if (status == null) {
            throw new IllegalArgumentException("Store status is required");
        }
        Store store = storeRepository.findById(id).orElseThrow(
                () -> new Exception("store not found...")
        );
        if (store.getStatus() == StoreStatus.ACTIVE && status == StoreStatus.PENDING) {
            throw new IllegalStateException("An active store cannot be reverted back to PENDING");
        }

        store.setStatus(status);
        if (status == StoreStatus.REJECTED) {
            if (reason != null && !reason.trim().isEmpty()) {
                store.setRejectionReason(reason.trim());
            }
        } else if (status == StoreStatus.ACTIVE) {
            store.setRejectionReason(null);
        } else if (status == StoreStatus.BLOCKED) {
            closeOpenStoreShifts(store.getId());
        }

        Store updatedStore = storeRepository.save(store);
        return storeRevenueEnricher.toEnrichedDTO(updatedStore);
    }

    private void closeOpenStoreShifts(Long storeId) {
        LocalDateTime now = LocalDateTime.now();
        List<ShiftReport> storeShifts = shiftReportRepository.findByBranchStoreId(storeId);
        for (ShiftReport sr : storeShifts) {
            if (sr.getShiftEnd() == null) {
                try {
                    shiftReportService.closeShiftInternal(sr.getId(), now);
                } catch (Exception ignored) {
                    sr.setShiftEnd(now);
                    shiftReportRepository.save(sr);
                }
            }
        }
    }
}
