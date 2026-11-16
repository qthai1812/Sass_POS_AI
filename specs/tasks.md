# Danh sách Công việc (Tasks) — Phân trang Đợt 1

> **Trạng thái:** Hoàn thành Đợt 1 (`Orders` & `Customers`)  
> **Tham chiếu:** `specs/spec.md`, `specs/plan.md`

---

## Backend (`pos-backend`)
- [x] **Task 1:** Tạo `PageResponse.java` và `PaginationUtils.java` dùng chung cho phân trang và whitelist trường sắp xếp.
- [x] **Task 2:** Tạo `CustomerDTO.java`, `CustomerSummaryDTO.java` và `CustomerMapper.java`.
- [x] **Task 3:** Cập nhật `CustomerRepository.java`, `CustomerService.java`, `CustomerServiceImpl.java` và `CustomerController.java` cho endpoint `/api/customers/paged` và `/api/customers/summary`.
- [x] **Task 4:** Cập nhật `OrderRepository.java`, `OrderService.java`, `OrderServiceImpl.java` và `OrderController.java` với Two-Step ID-First Pagination cho `/api/orders/branch/{branchId}/paged` và `/api/orders/cashier/{id}/paged`.
- [x] **Task 5:** Bổ sung unit tests & RBAC tests cho phân trang Customers và Orders (`CustomerServiceImplTest`, `OrderServiceImplTest`, `ControllerRbacSecurityTest`) và chạy kiểm chứng `mvn test`.

## Frontend (`pos-frontend`)
- [x] **Task 6:** Tạo `paginationUtils.js`, `paginationUtils.test.js` và component `DataTablePagination` (`components/ui/data-table-pagination.jsx`).
- [x] **Task 7:** Cập nhật Redux `customerThunks.js` / `customerSlice.js` và `orderThunks.js` / `orderSlice.js` bổ sung state và thunks phân trang.
- [x] **Task 8:** Tích hợp phân trang & server-side sort/filter vào Quản lý Đơn hàng Chi nhánh (`Orders.jsx`, `OrdersFilters.jsx`, `OrdersTable.jsx`).
- [x] **Task 9:** Tích hợp phân trang & server-side search/date-filter vào Lịch sử Đơn hàng Thu ngân (`OrderHistoryPage.jsx`).
- [x] **Task 10:** Tích hợp phân trang, tìm kiếm debounce & summary KPI toàn chuỗi vào Quản lý Khách hàng (`Customers.jsx`).
- [x] **Task 11:** Chạy kiểm chứng toàn bộ Backend tests (`mvn test`), Frontend unit tests (`npm test`), Frontend build (`npm run build`) và lint.
