# Đặc tả Yêu cầu Phân trang & Lazy Load — Đợt 4: Màn hình Thu ngân (`POS Products` & `Return / Refund`)

> **Trạng thái:** Đã hoàn tất & Kiểm chứng (Bước 4 / 4 — `spec-driven-workflow`)  
> **Nguyên tắc áp dụng:** `spec-driven-workflow`, `strict-stack-guard`, `senior-fullstack-dev`

---

## 1. Tổng quan & Lý do thực hiện (Why)

Sau 3 đợt phân trang các màn hình quản trị chính, 2 màn hình tác nghiệp trực tiếp của Thu ngân (`Cashier`) trước đây nằm ngoài phạm vi hiện vẫn đang tải 100% danh sách một lần:
1. **Lưới sản phẩm tại quầy POS (`CreateOrderPage -> ProductSection.jsx`):** Đang gọi `GET /api/products/store/{storeId}` để tải toàn bộ danh mục sản phẩm của cửa hàng và render toàn bộ ra lưới DOM. Theo yêu cầu trải nghiệm bán hàng nhanh, màn hình này cần chuyển sang **Lazy load (tải nối tiếp theo trang khi cuộn + nút tải thêm dự phòng)** kết hợp tìm kiếm phía máy chủ.
2. **Màn hình Hoàn trả / Đổi hàng (`ReturnOrderPage.jsx -> OrderTable.jsx`):** Đang gọi `GET /api/orders/branch/{branchId}` và `GET /api/refunds/branch/{branchId}` để tải toàn bộ đơn hàng và phiếu hoàn của chi nhánh rồi lọc ở client. Màn hình này cần chuyển sang **Phân trang phía máy chủ (Server-side Pagination)** chuẩn bảng dữ liệu (`DataTablePagination`).

---

## 2. Phạm vi nghiệp vụ (What — Scope Lock)

### 2.1. Trong phạm vi Đợt 4
1. **Ảnh 1 — Lưới sản phẩm POS Thu ngân (`ProductSection.jsx` — Lazy Load):**
   - Tái sử dụng endpoint phân trang đã có `GET /api/products/store/{storeId}/paged` (`ROLE_CASHIER` đã được cấp quyền).
   - Tải mỗi lần **12 sản phẩm** (`size = 12`, chia hết cho lưới 1/2/3 cột), nối tiếp trang sau vào danh sách hiện có bằng `IntersectionObserver` khi cuộn gần cuối danh sách (kèm nút *"Tải thêm sản phẩm"* dự phòng khi viewport cao chưa có thanh cuộn).
   - Tìm kiếm theo tên/SKU có debounce `350ms` gọi lại trang `0` từ `/api/products/store/{storeId}/paged?keyword=...` (bỏ gọi `getProductsByStore` full list và `searchProducts`).
   - Giữ nguyên `getInventoryByBranch(activeBranchId)` để đồng bộ tồn kho thời gian thực với `CartSection.jsx` và `usePosPaymentFlow.js`.

2. **Ảnh 2 — Danh sách đơn hoàn trả (`ReturnOrderPage.jsx` & `OrderTable.jsx` — Phân trang):**
   - **Backend (`pos-backend`):**
     - Mở rộng `GET /api/orders/branch/{branchId}/paged` thêm tham số tùy chọn `keyword` (tìm theo `#OrderID`, tên khách hàng hoặc `paymentType` ngay tại DB).
     - Bổ sung trường `refundedAmount` vào `OrderDTO` được tính batch bằng 1 truy vấn `SUM(r.amount)` cho tối đa `ids` của trang hiện tại trong `hydratePagedOrders(...)`, giúp cột `Remaining` trên bảng hoàn trả hiển thị chính xác mà không cần tải toàn bộ `refundsByBranch`.
   - **Frontend (`pos-frontend`):**
     - `ReturnOrderPage.jsx` ngừng gọi `getOrdersByBranch` và `getRefundsByBranch` (full list); giữ `getRefundsByOrder(selectedOrder.id)` khi xem/xử lý 1 đơn cụ thể.
     - `OrderTable.jsx` dùng `getOrdersByBranchPaged` (debounce tìm kiếm `350ms`, mặc định `size = 10`, sắp xếp mới nhất `createdAt desc`) kèm `<DataTablePagination>` (`10 / 20 / 50 / 100`).
     - `ReturnItemsSection.jsx` sau khi tạo hoàn tiền chỉ cập nhật `getRefundsByOrder`, `getOrderById`, `getInventoryByBranch` (và reload trang hiện tại của bảng đơn khi quay lại), không gọi lại toàn bộ `getOrdersByBranch`/`getRefundsByBranch`.

### 2.2. Ngoài phạm vi Đợt 4 (KHÔNG sửa đổi)
- Giữ nguyên `Branch Manager -> Orders.jsx` (vẫn dùng `getOrdersByBranchPaged` tương thích ngược), `Store -> Products.jsx`, `CartSection.jsx`, `usePosPaymentFlow.js`, `CustomerLookupPage.jsx`, `BranchEmployees.jsx`.

---

## 3. Ràng buộc kỹ thuật & Tiêu chí nghiệm thu

- Tuân thủ kiến trúc `Controller -> Service -> Repository`, whitelist `sortBy`, `size <= 100`, giữ nguyên `@PreAuthorize` và `AccessControlService`.
- Không tạo truy vấn N+1 hoặc cảnh báo `HHH90003004`.
- Toàn bộ unit test Backend (bao gồm `ZoshPosSystemApplicationTests` kết nối MySQL thật), unit test Frontend (`npm test`), production build (`npm run build`) và ESLint đều pass sau khi hoàn tất.
