# Kế hoạch Kiến trúc & Triển khai Phân trang — Đợt 2

> **Trạng thái:** Đã phê duyệt (Bước 2 / 4 — `spec-driven-workflow`)  
> **Tham chiếu:** `specs/spec-phase2.md`

---

## 1. Backend (`pos-backend`)

### 1.1. Module Sản phẩm (`Products`)
- `repository/ProductRepository.java`: Thêm `findByStorePaged(storeId, categoryId, keyword, pageable)` kèm `@EntityGraph(attributePaths = {"category", "store"})` (To-One, 1 SQL query `LIMIT/OFFSET`).
- `service/ProductService.java` & `service/impl/ProductServiceImpl.java`: Thêm `getProductsByStorePaged(storeId, keyword, categoryId, page, size, sortBy, sortDir)` giữ nguyên kiểm tra `assertCanReadStore(storeId)`.
- `controller/ProductController.java`: Thêm `GET /api/products/store/{storeId}/paged` (`@PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")`).

### 1.2. Module Tồn kho Chi nhánh (`Inventory`)
- `payload/dto/InventorySummaryDTO.java`: `{ totalItems, totalQuantity, lowStockCount, outOfStockCount }`.
- `repository/InventoryRepository.java`: Thêm `findByBranchPaged(branchId, keyword, category, pageable)` với `@EntityGraph(attributePaths = {"branch", "product", "product.category", "product.store"})`, và `summarizeBranchInventory(branchId, keyword, category)`.
- `service/InventoryService.java` & `service/impl/InventoryServiceImpl.java`: Thêm `getInventoryByBranchPaged(...)` và `getInventorySummaryByBranch(...)` với `assertCanAccessBranch`.
- `controller/InventoryController.java`: Thêm `GET /api/inventories/branch/{branchId}/paged` và `GET /api/inventories/branch/{branchId}/summary`.

### 1.3. Module Hoàn tiền (`Refunds`) — Two-Step ID-First Pagination
- `repository/RefundRepository.java`: Thêm `findBranchRefundIdsPaged(branchId, pageable)` (`Page<Long>`) và `findAllWithDetailsByIdIn(ids)` (`@EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})`).
- `service/RefundService.java` & `service/impl/RefundServiceImpl.java`: Inject `BranchRepository` để kiểm tra `assertCanAccessBranch(current, branch)` trước khi phân trang, thêm `getRefundsByBranchPaged(branchId, page, size, sortBy, sortDir)` bảo toàn thứ tự IDs từ Bước 1.
- `controller/RefundController.java`: Thêm `GET /api/refunds/branch/{branchId}/paged`.

### 1.4. Module Ca làm việc (`ShiftReports`) — Backend Two-Step ID-First Pagination
- `repository/ShiftReportRepository.java`: Thêm `findShiftIdsByCashierPaged`, `findShiftIdsByBranchPaged`, `findShiftIdsByStorePaged`, và `findAllWithDetailsByIdIn(ids)` (`@EntityGraph(attributePaths = {"cashier", "branch", "branch.store", "refunds"})`).
- `service/ShiftReportService.java` & `service/impl/ShiftReportServiceImpl.java`: Thêm `getAllShiftReportsPaged`, `getShiftReportsByBranchIdPaged`, `getShiftReportsByCashierIdPaged` (áp dụng phân quyền theo role ngay trong SQL query trước khi phân trang để tổng trang chính xác, map qua `toSummaryOrLiveDTO`).
- `controller/ShiftReportController.java`: Thêm `GET /api/shift-reports/paged`, `GET /api/shift-reports/branch/{branchId}/paged`, `GET /api/shift-reports/cashier/{cashierId}/paged`.

---

## 2. Frontend (`pos-frontend`)

### 2.1. Redux Toolkit
- `productThunks.js` & `productSlice.js`: Thêm `getProductsByStorePaged` và `pagedProducts`, `pagedLoading`.
- `inventoryThunks.js` & `inventorySlice.js`: Thêm `getInventoryByBranchPaged`, `getInventorySummaryByBranch` và `pagedInventories`, `pagedLoading`, `inventorySummary`.
- `refundThunks.js` & `refundSlice.js`: Thêm `getRefundsByBranchPaged` và `pagedBranchRefunds`, `pagedBranchLoading`.

### 2.2. UI Pages
- `pages/store/Product/Products.jsx` & `ProductSearch.jsx`: Chuyển sang tìm kiếm + phân trang server-side (`DataTablePagination`), reset về trang 0 khi tìm kiếm/đổi size, tự động làm mới / lùi trang khi xóa sản phẩm cuối trên trang.
- `pages/Branch Manager/Inventory/Inventory.jsx` & `InventoryFilters.jsx`: Dùng `pagedInventories` + `inventorySummary.totalQuantity`, debounce tìm kiếm 350ms, reset `page=0` khi đổi search/category/size, gắn `DataTablePagination` dưới `InventoryTable`, và `Export CSV` gọi API full danh sách `/api/inventories/branch/{branchId}` theo bộ lọc hiện hành.
- `pages/Branch Manager/Refunds/Refunds.jsx`: Dùng `pagedBranchRefunds`, thêm loading state và gắn `DataTablePagination`.
