# Kế hoạch Kiến trúc & Triển khai — Đợt 4 (Cashier POS Lazy Load & Return/Refund Pagination)

> **Trạng thái:** Đã hoàn tất (Bước 4 / 4 — `spec-driven-workflow`)  
> **Tham chiếu:** `specs/spec-phase4.md`

---

## 1. Backend (`pos-backend`)

### 1.1. Hỗ trợ `refundedAmount` batch & `keyword` cho `Orders` theo chi nhánh
- **`payload/dto/OrderDTO.java`:** Bổ sung `private Double refundedAmount;`.
- **`repository/RefundRepository.java`:** Thêm query batch tính tổng tiền đã hoàn theo danh sách đơn:
  - `List<Object[]> sumRefundAmountsByOrderIds(@Param("orderIds") List<Long> orderIds)`.
- **`repository/OrderRepository.java`:** Bổ sung điều kiện `@Param("keyword") String keyword` vào `findBranchOrderIdsPaged(...)` (tìm theo `CAST(o.id AS string)`, `c.fullName`, `CAST(o.paymentType AS string)`).
- **`service/OrderService.java` & `service/impl/OrderServiceImpl.java`:**
  - Giữ tương thích overload `getOrdersByBranchPaged(branchId, customerId, cashierId, paymentType, status, page, size, sortBy, sortDir)` và bổ sung tham số `String keyword` (chuẩn hóa `#id` qua `normalizeOrderSearchKeyword`).
  - Trong `hydratePagedOrders(Page<Long> idPage)`: gọi `refundRepository.sumRefundAmountsByOrderIds(ids)` 1 lần duy nhất và điền `dto.setRefundedAmount(...)` cho từng `OrderDTO` trên trang.
- **`controller/OrderController.java`:** Thêm `@RequestParam(required = false, defaultValue = "") String keyword` vào `GET /api/orders/branch/{branchId}/paged`.

### 1.2. Product POS Lazy Load Endpoint
- Tái sử dụng trực tiếp endpoint `GET /api/products/store/{storeId}/paged` (đã có `ROLE_CASHIER` tại `ProductController.java`). Không cần thêm endpoint backend mới cho Products.

---

## 2. Frontend (`pos-frontend`)

### 2.1. Redux Toolkit
- **`orderThunks.js`:** Bổ sung `keyword = ''` vào `getOrdersByBranchPaged`.
- **`orderSlice.js`:** Cập nhật `createRefund.fulfilled` để cộng dồn `refundedAmount` vào `pagedBranchOrders.content` và `selectedOrder` song song với cập nhật `status`.

### 2.2. UI Components
- **`pages/cashier/product/ProductSection.jsx` (Lazy Load):**
  - Quản lý danh sách sản phẩm POS theo trang (`page`, `size = 12`, `posProducts`, `totalElements`, `hasMore`, `loadingInitial`, `loadingMore`) với ref đếm sequence chống race condition khi gõ search nhanh.
  - Tự động nối trang kế tiếp bằng `IntersectionObserver` gắn vào sentinel cuối `div.overflow-y-auto`, kèm nút *"Tải thêm sản phẩm"* ở cuối lưới.
  - Debounce `350ms` khi gõ từ khóa tìm kiếm -> reset `page = 0` và fetch từ `getProductsByStorePaged`.
- **`pages/cashier/return/ReturnOrderPage.jsx` & `OrderTable.jsx` & `ReturnItemsSection.jsx` (Phân trang):**
  - `ReturnOrderPage.jsx`: Bỏ `getOrdersByBranch` & `getRefundsByBranch`; đồng bộ `activeSelectedOrder` từ `selectedOrder` hoặc `pagedBranchOrders?.content`; giữ `getRefundsByOrder(selectedOrder.id)`; truyền `branchId` và trigger làm mới xuống `OrderTable`.
  - `OrderTable.jsx`: Gọi `getOrdersByBranchPaged` với tìm kiếm debounce `350ms`, đọc `order.refundedAmount` (fallback `refundedAmountByOrderId`), và gắn `<DataTablePagination>`.
  - `ReturnItemsSection.jsx`: Sau `createRefund`, làm mới `getRefundsByOrder(selectedOrder.id)`, `getOrderById(selectedOrder.id)`, `getInventoryByBranch(effectiveBranchId)` (không tải lại full danh sách branch orders/refunds).
