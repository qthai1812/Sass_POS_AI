# Kế hoạch Kiến trúc & Triển khai Phân trang — Đợt 1 (`Orders` & `Customers`)

> **Trạng thái:** Đã phê duyệt từ `spec.md` (Bước 2 / 4 — `spec-driven-workflow`)  
> **Tham chiếu đặc tả:** `specs/spec.md`

---

## 1. Kiến trúc tổng thể (Architecture Overview)

### 1.1. Backend (`pos-backend`) — Layered Architecture
- **Shared Pagination Infrastructure:**
  - `payload/response/PageResponse.java`: Generic DTO bọc dữ liệu phân trang (`content`, `pageNumber`, `pageSize`, `totalElements`, `totalPages`, `first`, `last`) kèm factory method `from(Page<E>, Function<E, T>)` và `of(Page<?>, List<T>)`.
  - `util/PaginationUtils.java`: Chuẩn hóa `page >= 0`, `size` trong khoảng `[1, 100]` (mặc định `10`), và whitelist `sortBy` + `sortDir` để chống lỗi `PropertyReferenceException` hoặc probing trường nội bộ.
- **Module Khách hàng (`Customers`):**
  - `payload/dto/CustomerDTO.java` & `mapper/CustomerMapper.java`: DTO cho response phân trang khách hàng.
  - `payload/dto/CustomerSummaryDTO.java`: Thống kê tổng hợp toàn chuỗi (`totalCustomers`, `goldAndDiamondCount`, `totalLoyaltyPoints`) bằng SQL aggregate (`COUNT`, `SUM`) để giữ chính xác 3 KPI cards trên UI khi chuyển sang phân trang.
  - `repository/CustomerRepository.java`: Thêm query phân trang `findByStoreId(Long, Pageable)`, `searchCustomersByStore(Long, String, Pageable)` và aggregate queries cho summary.
  - `service/CustomerService.java` & `service/impl/CustomerServiceImpl.java`: Thêm `getCustomersPaged(...)` và `getCustomerSummary()`.
  - `controller/CustomerController.java`: Thêm `GET /api/customers/paged` và `GET /api/customers/summary`. Giữ nguyên các endpoint cũ.
- **Module Đơn hàng (`Orders`) — Two-Step ID-First Pagination:**
  - Để tránh cảnh báo/lỗi Hibernate `HHH90003004` (in-memory pagination khi dùng `Pageable` chung với `@EntityGraph` fetch `@OneToMany items`):
    1. **Bước 1:** Truy vấn `Page<Long>` chỉ lấy danh sách `o.id` thỏa mãn điều kiện lọc + phân trang + sắp xếp trực tiếp tại MySQL (`LIMIT/OFFSET` + `COUNT`).
    2. **Bước 2:** Nạp chi tiết `List<Order>` qua `@EntityGraph` bằng `WHERE o.id IN :ids` (tối đa `size` bản ghi của trang hiện tại) rồi khôi phục đúng thứ tự từ Bước 1 trước khi map sang `OrderDTO`.
  - `repository/OrderRepository.java`: Thêm `findBranchOrderIdsPaged(...)`, `findCashierOrderIdsPaged(...)` (dùng `LEFT JOIN o.customer` để không mất đơn Walk-in Customer), và `findAllWithDetailsByIdIn(...)`.
  - `service/OrderService.java` & `service/impl/OrderServiceImpl.java`: Thêm `getOrdersByBranchPaged(...)` và `getOrdersByCashierPaged(...)`, tái sử dụng hoàn toàn kiểm tra phân quyền chi nhánh/thu ngân hiện có.
  - `controller/OrderController.java`: Thêm `GET /api/orders/branch/{branchId}/paged` và `GET /api/orders/cashier/{id}/paged`. Giữ nguyên các endpoint `List` cũ.

### 1.2. Frontend (`pos-frontend`) — State & UI Architecture
- **Shared Pagination Utility & UI:**
  - `src/utils/paginationUtils.js`: Logic tính danh sách trang hiển thị (có ellipsis `...`), tính phạm vi `startItem`–`endItem`, và chuẩn hóa metadata.
  - `src/components/ui/data-table-pagination.jsx`: Component tái sử dụng xây dựng trên `ui/pagination.jsx` và `ui/select.jsx`, hỗ trợ đổi `pageSize` (`10, 20, 50, 100`), chuyển trang và hiển thị tổng số bản ghi.
- **Redux Toolkit (`orderSlice` / `orderThunks` & `customerSlice` / `customerThunks`):**
  - Bổ sung các state phân trang song song (`pagedBranchOrders`, `pagedCashierOrders`, `pagedCustomers`, `customerSummary`) và thunks tương ứng gọi các endpoint `/paged` & `/summary`, không làm thay đổi shape của state mảng cũ (`orders`, `customers`) dùng cho POS/Returns/Employees.
- **UI Pages:**
  - `pages/Branch Manager/Orders/` (`Orders.jsx`, `OrdersFilters.jsx`, `OrdersTable.jsx`): Quản lý filter/sort/page tập trung tại `Orders.jsx`; sort thực thi trên server; gắn `DataTablePagination`.
  - `pages/cashier/order/OrderHistoryPage.jsx`: Chuyển tìm kiếm & lọc khoảng ngày (`all`, `today`, `week`, `month`, `custom`) sang truyền query params cho `getOrdersByCashierPaged`; gắn `DataTablePagination`.
  - `pages/common/Customers/Customers.jsx`: Chuyển tìm kiếm (debounce 350ms) và hiển thị bảng sang `getCustomersPaged` + `getCustomerSummary`; gắn `DataTablePagination` và xử lý lùi trang khi xóa phần tử cuối của trang.

---

## 2. API Contracts Mới

| Method | Endpoint | Query Params | Response | Roles |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/customers/paged` | `keyword`, `page=0`, `size=10`, `sortBy=createdAt`, `sortDir=desc` | `PageResponse<CustomerDTO>` | `STORE_OWNER`, `BRANCH_MANAGER`, `CASHIER` |
| `GET` | `/api/customers/summary` | — | `CustomerSummaryDTO` | `STORE_OWNER`, `BRANCH_MANAGER`, `CASHIER` |
| `GET` | `/api/orders/branch/{branchId}/paged` | `customerId`, `cashierId`, `paymentType`, `status`, `page=0`, `size=10`, `sortBy=createdAt`, `sortDir=desc` | `PageResponse<OrderDTO>` | `STORE_OWNER`, `BRANCH_MANAGER`, `CASHIER` |
| `GET` | `/api/orders/cashier/{id}/paged` | `keyword`, `startDate`, `endDate` (`YYYY-MM-DD`), `page=0`, `size=10`, `sortBy=createdAt`, `sortDir=desc` | `PageResponse<OrderDTO>` | `STORE_OWNER`, `BRANCH_MANAGER`, `CASHIER` |

---

## 3. Danh sách Files Tạo mới & Chỉnh sửa

### Backend (`pos-backend/src/main/java/com/zosh/`)
- **Tạo mới:**
  - `payload/response/PageResponse.java`
  - `util/PaginationUtils.java`
  - `payload/dto/CustomerDTO.java`
  - `payload/dto/CustomerSummaryDTO.java`
  - `mapper/CustomerMapper.java`
- **Chỉnh sửa:**
  - `repository/CustomerRepository.java`, `service/CustomerService.java`, `service/impl/CustomerServiceImpl.java`, `controller/CustomerController.java`
  - `repository/OrderRepository.java`, `service/OrderService.java`, `service/impl/OrderServiceImpl.java`, `controller/OrderController.java`
- **Unit & Security Tests (`pos-backend/src/test/java/com/zosh/`):**
  - Cập nhật `controller/ControllerRbacSecurityTest.java`, `service/impl/CustomerServiceImplTest.java`, `service/impl/OrderServiceImplTest.java`.

### Frontend (`pos-frontend/src/`)
- **Tạo mới:**
  - `utils/paginationUtils.js`
  - `utils/paginationUtils.test.js`
  - `components/ui/data-table-pagination.jsx`
- **Chỉnh sửa:**
  - `Redux Toolkit/features/customer/customerThunks.js`, `customerSlice.js`
  - `Redux Toolkit/features/order/orderThunks.js`, `orderSlice.js`
  - `pages/Branch Manager/Orders/Orders.jsx`, `OrdersFilters.jsx`, `OrdersTable.jsx`
  - `pages/cashier/order/OrderHistoryPage.jsx`
  - `pages/common/Customers/Customers.jsx`
