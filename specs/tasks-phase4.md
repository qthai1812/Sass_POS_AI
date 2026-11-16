# Danh sách Công việc (Tasks) — Đợt 4 (Cashier POS Lazy Load & Return/Refund Pagination)

> **Trạng thái:** Hoàn tất (Verified Backend + Frontend)  
> **Tham chiếu:** `specs/spec-phase4.md`, `specs/plan-phase4.md`

---

## Backend (`pos-backend`)
- [x] **Task 1:** Thêm `refundedAmount` vào `OrderDTO.java` và `sumRefundAmountsByOrderIds` vào `RefundRepository.java`.
- [x] **Task 2:** Mở rộng `OrderRepository.findBranchOrderIdsPaged`, `OrderService`, `OrderServiceImpl` (`keyword` + batch `refundedAmount` trong `hydratePagedOrders`), và `OrderController.getOrderByBranchPaged`.
- [x] **Task 3:** Bổ sung unit test cho `OrderServiceImplTest` (`keyword` branch paged + batch `refundedAmount`) và chạy `mvn test` (gồm `ZoshPosSystemApplicationTests`).

## Frontend (`pos-frontend`)
- [x] **Task 4:** Cập nhật `orderThunks.js` (`keyword` trong `getOrdersByBranchPaged`) và `orderSlice.js` (cập nhật `refundedAmount` khi `createRefund.fulfilled`).
- [x] **Task 5:** Nâng cấp `ProductSection.jsx` sang Lazy load (`getProductsByStorePaged`, `size = 12`, `IntersectionObserver` + nút Tải thêm + search server-side debounce 350ms).
- [x] **Task 6:** Nâng cấp `ReturnOrderPage.jsx`, `OrderTable.jsx`, `ReturnItemsSection.jsx` sang phân trang server-side với `<DataTablePagination>`.
- [x] **Task 7:** Chạy kiểm chứng toàn bộ Backend tests (`mvn test`), Frontend unit tests (`npm test`), Frontend build (`npm run build`) và ESLint.
