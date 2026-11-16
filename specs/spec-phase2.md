# Đặc tả Yêu cầu Phân trang — Đợt 2: Products, Inventory, Refunds & ShiftReports

> **Trạng thái:** Đã chốt yêu cầu & Phê duyệt (Bước 1 / 4 — `spec-driven-workflow`)  
> **Nguyên tắc áp dụng:** `spec-driven-workflow`, `strict-stack-guard`, `senior-fullstack-dev`

---

## 1. Tổng quan & Lý do thực hiện (Why)

Sau Đợt 1 (`Orders` & `Customers`), các danh mục tăng trưởng lớn còn lại trong Nhóm 1 vẫn đang trả toàn bộ `List<T>` từ Database và render toàn bộ DOM:
- **Sản phẩm (`Products`)**: Danh mục thời trang theo SKU/màu/size dễ tăng lên hàng nghìn bản ghi.
- **Tồn kho Chi nhánh (`Inventory`)**: Tăng tỷ lệ thuận với `Số SKU × Chi nhánh`.
- **Phiếu hoàn tiền (`Refunds`)**: Lịch sử hoàn tiền tích lũy dài hạn, Entity `Refund` có `@OneToMany items`.
- **Ca làm việc (`ShiftReports`)**: Backend đã có các API danh sách ca làm việc nhưng chưa có phân trang.

---

## 2. Phạm vi nghiệp vụ đã chốt (What — Scope Lock)

1. **Sản phẩm (`Products`) — Backend + Frontend:**
   - Backend: `GET /api/products/store/{storeId}/paged` (`keyword`, `categoryId`, `page`, `size`, `sortBy`, `sortDir`).
   - Frontend: `store/Product/Products.jsx` (+ `ProductSearch.jsx`, `ProductTable.jsx`) dùng phân trang server-side và `DataTablePagination`.
2. **Tồn kho Chi nhánh (`Inventory`) — Backend + Frontend:**
   - Backend: `GET /api/inventories/branch/{branchId}/paged` (`keyword`, `category`, `page`, `size`, `sortBy`, `sortDir`) và `GET /api/inventories/branch/{branchId}/summary` (`keyword`, `category`).
   - Frontend: `Branch Manager/Inventory/Inventory.jsx` (+ `InventoryFilters.jsx`, `InventoryTable.jsx`) hiển thị dữ liệu theo trang, `Total Quantity` lấy từ `/summary`, nút **`Export CSV`** tải danh sách đầy đủ theo bộ lọc hiện tại khi được bấm.
3. **Phiếu hoàn tiền (`Refunds`) — Backend + Frontend:**
   - Backend: `GET /api/refunds/branch/{branchId}/paged` dùng Two-Step ID-First Pagination (tránh Hibernate `HHH90003004`).
   - Frontend: `Branch Manager/Refunds/Refunds.jsx` gắn `DataTablePagination`.
4. **Ca làm việc (`ShiftReports`) — Chỉ Backend (Scope Lock):**
   - Backend: Bổ sung `GET /api/shift-reports/paged`, `GET /api/shift-reports/branch/{branchId}/paged`, `GET /api/shift-reports/cashier/{cashierId}/paged` dùng Two-Step ID-First Pagination, giữ nguyên quy tắc phân quyền hiện hành.
   - Frontend: Không tự ý tạo trang UI mới vì hiện tại hệ thống chưa có màn hình bảng lịch sử ca.
5. **Bảo toàn tương thích ngược:**
   - Giữ nguyên toàn bộ các endpoint `List` cũ cho POS (`ProductSection.jsx`, `usePosPaymentFlow.js`), `Alerts.jsx`, `ReturnOrderPage.jsx`, `ReturnItemsSection.jsx`, `Transactions.jsx`, và dropdown thêm tồn kho `InventoryFormDialog.jsx`.

---

## 3. Ràng buộc kỹ thuật & Tiêu chí nghiệm thu

- Tuân thủ `Controller -> Service -> Repository`, trả DTO qua `PageResponse<T>` (`page=0`, `size=10`, tối đa `100`, whitelist `sortBy`).
- Giữ nguyên `@PreAuthorize` và Multi-Tenant Isolation (`AccessControlService`).
- Mọi bộ lọc + phân trang thực thi tại MySQL, không lọc in-memory, không cảnh báo Hibernate `HHH90003004`.
- Toàn bộ unit test Backend, unit test Frontend, build và ESLint phải pass sau khi triển khai.
