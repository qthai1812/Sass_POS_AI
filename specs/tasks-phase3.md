# Danh sách Công việc (Tasks) — Phân trang Đợt 3

> **Trạng thái:** Hoàn tất (Verified Backend + Frontend)  
> **Tham chiếu:** `specs/spec-phase3.md`, `specs/plan-phase3.md`

---

## Backend (`pos-backend`)
- [x] **Task 1:** Tạo `StoreSummaryDTO.java`, cập nhật `StoreRevenueEnricher`, `StoreRepository`, `StoreService`, `StoreServiceImpl`, `StoreController` cho `/api/stores/paged` và `/api/stores/summary`.
- [x] **Task 2:** Cập nhật `SubscriptionRepository`, `SubscriptionService`, `SubscriptionServiceImpl`, `SubscriptionController` cho `/api/subscriptions/admin/paged`.
- [x] **Task 3:** Tạo `BranchTransferSummaryDTO.java`, cập nhật `BranchTransferRequestRepository`, `BranchTransferRequestService`, `BranchTransferRequestServiceImpl`, `BranchTransferRequestController` cho `/paged` và `/summary`.
- [x] **Task 4:** Bổ sung unit tests & RBAC security tests cho `Store`, `Subscription`, `BranchTransferRequest` và chạy `mvn test`.

## Frontend (`pos-frontend`)
- [x] **Task 5:** Cập nhật Redux `storeThunks`/`storeSlice` và `subscriptionThunks`/`subscriptionSlice`.
- [x] **Task 6:** Tích hợp phân trang vào `StoreTable.jsx`, `PendingRequestsPage.jsx`, và `CommissionsPage.jsx`.
- [x] **Task 7:** Tích hợp phân trang vào `StoreSubscriptionsTable.jsx`.
- [x] **Task 8:** Tích hợp phân trang & summary vào khối yêu cầu chuyển chi nhánh trong `StoreEmployees.jsx`.
- [x] **Task 9:** Chạy kiểm chứng toàn bộ Backend tests (`mvn test`), Frontend unit tests (`npm test`), Frontend build (`npm run build`) và ESLint.
