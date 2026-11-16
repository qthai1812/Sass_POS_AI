# Kế hoạch Kiến trúc & Triển khai Phân trang — Đợt 3

> **Trạng thái:** Đã phê duyệt (Bước 2 / 4 — `spec-driven-workflow`)  
> **Tham chiếu:** `specs/spec-phase3.md`

---

## 1. Backend (`pos-backend`)

### 1.1. Module Cửa hàng (`Stores`)
- `payload/dto/StoreSummaryDTO.java`: `{ totalStores, activeStores, pendingStores, blockedStores, rejectedStores, averageCommissionRate, totalEarnings }`.
- `service/store/StoreRevenueEnricher.java`: Thêm `computeTotalPlatformEarnings(List<Object[]> storeIdAndRateRows)` tái sử dụng `computeNetRevenueByStore()`.
- `repository/StoreRepository.java`: Thêm `findStoresPaged(status, keyword, pageable)` với `@EntityGraph(attributePaths = {"storeAdmin"})`, `findAverageCommissionRate()`, và `findAllIdAndCommissionRate()`.
- `service/StoreService.java` & `service/impl/StoreServiceImpl.java`: Thêm `getAllStoresPaged(...)` và `getStoreSummary()`.
- `controller/StoreController.java`: Thêm `GET /api/stores/paged` và `GET /api/stores/summary` (`@PreAuthorize("hasRole('SUPER_ADMIN')")`).

### 1.2. Module Thuê bao (`Subscriptions`)
- `repository/SubscriptionRepository.java`: Thêm `findAdminByStatusPaged(status, pageable)` và `findAdminExpiringPaged(cutoff, statuses, pageable)` kèm `@EntityGraph(attributePaths = {"store"})`.
- `service/SubscriptionService.java` & `service/impl/SubscriptionServiceImpl.java`: Thêm `getAllSubscriptionsPaged(status, expiringDays, page, size, sortBy, sortDir)` (có `assertSuperAdmin()`).
- `controller/SubscriptionController.java`: Thêm `GET /api/subscriptions/admin/paged` (`@PreAuthorize("hasRole('SUPER_ADMIN')")`).

### 1.3. Module Yêu cầu Chuyển Chi nhánh (`BranchTransferRequests`)
- `payload/dto/BranchTransferSummaryDTO.java`: `{ totalRequests, pendingRequests }`.
- `repository/BranchTransferRequestRepository.java`: Thêm `findByStoreIdPaged(storeId, status, pageable)` với `@EntityGraph(attributePaths = {"employee", "store", "fromBranch", "toBranch", "reviewedBy"})`, `countByStoreId(storeId)`, `countByStoreIdAndStatus(storeId, status)`.
- `service/BranchTransferRequestService.java` & `service/impl/BranchTransferRequestServiceImpl.java`: Thêm `getStoreRequestsPaged(...)` và `getStoreRequestSummary(storeId)` kiểm tra `isStoreLevelUser(currentUser, store)`.
- `controller/BranchTransferRequestController.java`: Thêm `GET /api/branch-transfer-requests/store/{storeId}/paged` và `GET /api/branch-transfer-requests/store/{storeId}/summary`.

---

## 2. Frontend (`pos-frontend`)

### 2.1. Redux Toolkit
- `storeThunks.js` & `storeSlice.js`: Thêm `getAllStoresPaged`, `getStoreSummary` cùng state `pagedStores`, `pagedLoading`, `storeSummary`.
- `subscriptionThunks.js` & `subscriptionSlice.js`: Thêm `getAllSubscriptionsPaged` cùng state `pagedAdminSubscriptions`, `pagedAdminLoading`.

### 2.2. UI Pages
- `SuperAdminDashboard/store/StoreTable.jsx`: Tìm kiếm debounce 350ms + lọc status server-side + `DataTablePagination` + refetch sau moderate/delete.
- `SuperAdminDashboard/store/PendingRequestsPage.jsx`: Dùng `getAllStoresPaged({ status: "PENDING", ... })` + `DataTablePagination` + badge `totalElements`.
- `SuperAdminDashboard/CommissionsPage.jsx`: Dùng `getAllStoresPaged` + `getStoreSummary` cho 3 KPI cards + `DataTablePagination`.
- `SuperAdminDashboard/subscription/StoreSubscriptionsTable.jsx`: Dùng `getAllSubscriptionsPaged` cho cả filter trạng thái & "Sắp hết hạn 7 ngày" + `DataTablePagination`.
- `store/Employee/StoreEmployees.jsx`: Gọi `/api/branch-transfer-requests/store/{storeId}/paged` & `/summary`, gắn `DataTablePagination` dưới khối đơn yêu cầu chuyển chi nhánh.
