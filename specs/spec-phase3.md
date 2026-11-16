# Đặc tả Yêu cầu Phân trang — Đợt 3: SaaS Platform (`Stores`, `Subscriptions`, `BranchTransferRequests`)

> **Trạng thái:** Đã chốt yêu cầu & Phê duyệt (Bước 1 / 4 — `spec-driven-workflow`)  
> **Nguyên tắc áp dụng:** `spec-driven-workflow`, `strict-stack-guard`, `senior-fullstack-dev`

---

## 1. Tổng quan & Lý do thực hiện (Why)

Sau khi hoàn thành phân trang toàn bộ **Nhóm 1** (Đợt 1 & Đợt 2), các bảng quản trị quy mô nền tảng SaaS ở **Nhóm 2** vẫn đang tải toàn bộ bản ghi và render 100% DOM:
- **Quản lý Cửa hàng (`Stores` — Super Admin):** Các màn hình duyệt và quản trị cửa hàng (`StoreTable`, `PendingRequestsPage`, `CommissionsPage`) cần phân trang và lọc/tìm kiếm phía máy chủ để đáp ứng quy mô nhiều chuỗi cửa hàng.
- **Quản lý Gói thuê bao (`Subscriptions` — Super Admin):** Bảng danh sách thuê bao tích lũy theo chu kỳ tháng/năm (`StoreSubscriptionsTable.jsx`).
- **Đơn yêu cầu chuyển chi nhánh nhân viên (`BranchTransferRequests` — Store Owner):** Lịch sử đơn chuyển chi nhánh tại chuỗi nhiều cơ sở (`StoreEmployees.jsx`).

---

## 2. Phạm vi nghiệp vụ đã chốt (What — Scope Lock)

1. **Cửa hàng (`Stores` — Super Admin):**
   - **Backend:** Bổ sung `GET /api/stores/paged` (`status`, `keyword`, `page`, `size`, `sortBy`, `sortDir`) và `GET /api/stores/summary` (`StoreSummaryDTO`).
   - **Frontend:** Áp dụng phân trang cho cả 3 màn hình: `StoreTable.jsx`, `PendingRequestsPage.jsx`, và `CommissionsPage.jsx` (KPI cards lấy từ `/api/stores/summary`).
2. **Gói thuê bao (`Subscriptions` — Super Admin):**
   - **Backend:** Bổ sung `GET /api/subscriptions/admin/paged` (`status`, `expiringDays`, `page`, `size`, `sortBy`, `sortDir`).
   - **Frontend:** `StoreSubscriptionsTable.jsx` dùng phân trang server-side cho cả chế độ lọc trạng thái và chế độ "Sắp hết hạn 7 ngày".
3. **Đơn yêu cầu chuyển chi nhánh (`BranchTransferRequests` — Store Owner):**
   - **Backend:** Bổ sung `GET /api/branch-transfer-requests/store/{storeId}/paged` (`status`, `page`, `size`, `sortBy`, `sortDir`) và `GET /api/branch-transfer-requests/store/{storeId}/summary` (`totalRequests`, `pendingRequests`).
   - **Frontend:** Khối đơn yêu cầu chuyển chi nhánh trong `StoreEmployees.jsx` gắn `DataTablePagination` và đồng bộ badge đếm chính xác.
4. **Tương thích ngược:** Giữ nguyên các endpoint `List` cũ cho `Dashboard.jsx`, `ExportsPage.jsx`, `useSubscriptionUpgradeFlow.js`, và `MyInformationDialog.jsx`.

---

## 3. Ràng buộc kỹ thuật & Tiêu chí nghiệm thu

- Tuân thủ `Controller -> Service -> Repository`, dùng DTO qua `PageResponse<T>` (`page=0`, `size=10`, tối đa `100`, whitelist `sortBy`).
- Giữ nguyên `@PreAuthorize` (`SUPER_ADMIN`, `STORE_OWNER`) và `AccessControlService`.
- Toàn bộ lọc/tìm kiếm/phân trang thực thi tại Database (không lọc in-memory, không cảnh báo `HHH90003004`).
- Mọi unit test Backend, unit test Frontend, production build và ESLint phải pass sau khi triển khai.
