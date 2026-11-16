# Danh sách Công việc (Tasks) — Phân trang Đợt 2

> **Trạng thái:** Đang hoàn tất kiểm chứng (Bước 4 — `spec-driven-workflow`)  
> **Tham chiếu:** `specs/spec-phase2.md`, `specs/plan-phase2.md`

---

## Backend (`pos-backend`)
- [x] **Task 1:** Phân trang `Products` (`ProductRepository`, `ProductService`, `ProductServiceImpl`, `ProductController`).
- [x] **Task 2:** Tạo `InventorySummaryDTO` và phân trang + summary `Inventory` (`InventoryRepository`, `InventoryService`, `InventoryServiceImpl`, `InventoryController`).
- [x] **Task 3:** Phân trang `Refunds` theo Two-Step ID-First Pagination (`RefundRepository`, `RefundService`, `RefundServiceImpl`, `RefundController`).
- [x] **Task 4:** Phân trang Backend `ShiftReports` theo Two-Step ID-First Pagination (`ShiftReportRepository`, `ShiftReportService`, `ShiftReportServiceImpl`, `ShiftReportController`).
- [x] **Task 5:** Bổ sung unit tests & RBAC security tests cho `Product`, `Inventory`, `Refund`, `ShiftReport` và chạy kiểm chứng `mvn test`.

## Frontend (`pos-frontend`)
- [x] **Task 6:** Cập nhật Redux `productSlice`/`productThunks`, `inventorySlice`/`inventoryThunks`, `refundSlice`/`refundThunks`.
- [x] **Task 7:** Tích hợp phân trang vào trang Quản lý Sản phẩm (`Products.jsx`, `ProductSearch.jsx`, `ProductTable.jsx`).
- [x] **Task 8:** Tích hợp phân trang, tổng số lượng server-side & Export CSV đầy đủ vào Quản lý Tồn kho (`Inventory.jsx`, `InventoryFilters.jsx`, `InventoryTable.jsx`).
- [x] **Task 9:** Tích hợp phân trang vào Lịch sử Hoàn tiền (`Refunds.jsx`).
- [x] **Task 10:** Chạy kiểm chứng toàn bộ Backend tests (`mvn test`), Frontend unit tests (`npm test`), Frontend build (`npm run build`) và ESLint.
