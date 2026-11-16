# Đặc tả Yêu cầu Phân trang — Đợt 1: Orders & Customers

> **Trạng thái:** Đã chốt yêu cầu — Chờ phê duyệt (Bước 1 / 4 — `spec-driven-workflow`)  
> **Nguyên tắc áp dụng:** `spec-driven-workflow`, `strict-stack-guard`, `senior-fullstack-dev`

---

## 1. Tổng quan & Lý do thực hiện (Why)

### 1.1. Vấn đề hiện tại
Qua kiểm tra mã nguồn `pos-backend` và `pos-frontend`, toàn bộ các endpoint danh sách đang trả về `List<T>` đầy đủ và toàn bộ giao diện bảng đang render 100% phần tử qua `.map()`:
- **Rủi ro phía Backend:** `OrderServiceImpl.getOrdersByBranch` đang tải toàn bộ đơn hàng của chi nhánh từ MySQL lên bộ nhớ RAM JVM rồi mới lọc bằng Java Stream (`in-memory filtering`), và `CustomerServiceImpl.getAllCustomers` đang tải toàn bộ khách hàng của cửa hàng. Khi dữ liệu tăng lên hàng chục nghìn bản ghi, hệ thống đối mặt nguy cơ `OutOfMemoryError`, tăng độ trễ API và phình kích thước payload JSON.
- **Rủi ro phía Frontend:** Các bảng dữ liệu (`OrdersTable.jsx`, `Customers.jsx`, `OrderHistoryPage.jsx`) render trực tiếp toàn bộ bản ghi vào DOM gây giật lag hoặc treo trình duyệt; thành phần UI `components/ui/pagination.jsx` đã có sẵn nhưng chưa được sử dụng.

### 1.2. Mục tiêu
Bổ sung cơ chế **phân trang phía máy chủ (Server-side Pagination)** kết hợp lọc/tìm kiếm và sắp xếp trực tiếp ở tầng cơ sở dữ liệu (Database), đồng bộ với **Redux Toolkit** và **giao diện phân trang thống nhất** ở Frontend cho 2 module trọng yếu là **Đơn hàng (`Orders`)** và **Khách hàng (`Customers`)**.

---

## 2. Phạm vi nghiệp vụ đã chốt (What — Scope Lock)

### 2.1. Trong phạm vi Đợt 1
1. **Hạ tầng phân trang dùng chung (Shared Pagination Infrastructure):**
   - Backend: Cấu trúc phản hồi phân trang chuẩn `PageResponse<T>`.
   - Frontend: Component thanh phân trang tái sử dụng dựa trên `components/ui/pagination.jsx` và UI Shadcn/Tailwind hiện có.
2. **Module Đơn hàng (`Orders`):**
   - **Backend:** Bổ sung endpoint phân trang mới `/paged` (giữ nguyên các endpoint trả `List` cũ để bảo toàn tương thích ngược):
     - Đơn hàng theo chi nhánh (hỗ trợ lọc `cashierId`, `paymentType`, `status`).
     - Đơn hàng theo thu ngân.
   - **Frontend:**
     - Trang Quản lý Đơn hàng Chi nhánh (`Branch Manager -> Orders` + bộ lọc `OrdersFilters`).
     - Trang Lịch sử Đơn hàng Thu ngân (`Cashier -> Order History`, chuyển filter tìm kiếm/ngày sang tương thích phân trang hoặc kết hợp server-side theo thiết kế ở bước Plan).
3. **Module Khách hàng (`Customers`):**
   - **Backend:** Bổ sung endpoint phân trang mới `/paged` (hỗ trợ lọc `keyword` theo tên, email, SĐT) và chuẩn hóa kiểu trả về bằng **`CustomerDTO`** (không trả trực tiếp JPA Entity `Customer`).
   - **Frontend:** Trang Danh sách Khách hàng (`common/Customers/Customers.jsx`), chuyển tìm kiếm và hiển thị danh sách sang phân trang phía máy chủ.

### 2.2. Ngoài phạm vi Đợt 1 (KHÔNG sửa đổi)
- Các module thuộc Đợt 2 (`Products`, `Inventory`, `Refunds`, `ShiftReports`, `SuperAdmin Stores/Subscriptions`).
- Các màn hình phụ đang dùng endpoint `List` cũ (`BranchEmployees.jsx`, `ReturnOrderPage.jsx`, `Transactions.jsx`, `CustomerDialog.jsx`, `CustomerLookupPage.jsx`) phải tiếp tục hoạt động bình thường không bị ảnh hưởng.

---

## 3. Đặc tả Input / Output & Hành vi hệ thống

### 3.1. Đầu vào chuẩn (Pagination Query Parameters)
- `page`: Số thứ tự trang (0-indexed, mặc định `0`).
- `size`: Số lượng bản ghi trên mỗi trang (mặc định **`10`**, tối đa `100` để tránh lạm dụng truy vấn).
- `sortBy`: Trường sắp xếp (mặc định `createdAt` đối với Orders và `id` hoặc `createdAt` đối với Customers).
- `sortDir`: Chiều sắp xếp (`asc` hoặc `desc`, mặc định `desc` — mới nhất lên đầu).
- Tham số lọc/tìm kiếm đi kèm:
  - Orders theo chi nhánh: `cashierId`, `paymentType`, `status`.
  - Customers: `keyword` (tùy chọn; tìm kiếm gần đúng không phân biệt hoa/thường theo `fullName`, `email`, `phone` trong phạm vi `store`).

### 3.2. Đầu ra chuẩn (`PageResponse<T>`)
Mọi endpoint `/paged` trả về cấu trúc JSON thống nhất:
- `content`: Mảng DTO (`OrderDTO` hoặc `CustomerDTO`) của trang hiện tại.
- `pageNumber`: Trang hiện tại (0-indexed).
- `pageSize`: Kích thước trang hiện tại.
- `totalElements`: Tổng số bản ghi khớp điều kiện lọc trong DB.
- `totalPages`: Tổng số trang.
- `first`: `true` nếu là trang đầu tiên.
- `last`: `true` nếu là trang cuối cùng.

### 3.3. Yêu cầu hành vi giao diện (UI/UX Behavior)
1. Sử dụng lại UI primitives trong `components/ui/pagination.jsx` và `components/ui/select.jsx`.
2. Thanh phân trang dưới bảng hiển thị:
   - Thông tin phạm vi bản ghi đang xem (ví dụ: *Hiển thị 1–10 trên tổng số 145 kết quả*).
   - Dropdown chọn kích thước trang: **`10`, `20`, `50`, `100`** (mặc định `10`).
   - Nút Trang trước / Trang sau và dãy số trang (có rút gọn `...` khi nhiều trang).
3. Khi thay đổi bộ lọc hoặc từ khóa tìm kiếm (có debounce hợp lý khi gõ): tự động đặt lại `page = 0`.
4. Khi xóa hoặc cập nhật bản ghi ở trang hiện tại: làm mới đúng trang hiện tại; nếu trang hiện tại không còn phần tử nào và `page > 0`, tự động lùi về `page - 1`.

---

## 4. Ràng buộc kỹ thuật & Nguyên tắc tuân thủ

1. **Tuân thủ `strict-stack-guard`:**
   - Backend tuân thủ phân tầng `Controller -> Service -> Repository`.
   - Sử dụng DTO cho Response (`OrderDTO`, `CustomerDTO`, `PageResponse<T>`), tuyệt đối không trả trực tiếp JPA Entity ra API phân trang mới.
   - Giữ nguyên cơ chế bảo mật JWT, `@PreAuthorize`, và cô lập dữ liệu Multi-Tenant (`AccessControlService`).
   - Frontend dùng Functional Components, Redux Toolkit cho global state, Axios instance sẵn có (`utils/api.js`), không cài thêm thư viện ngoài.
2. **Tối ưu truy vấn Database (`senior-fullstack-dev`):**
   - Toàn bộ lọc (`WHERE`) và phân trang (`LIMIT/OFFSET`) thực thi trực tiếp tại Database (JPQL / Spring Data JPA `Specification` / `Pageable`), loại bỏ hoàn toàn lọc trên RAM (`in-memory stream filter`).
   - Tránh cảnh báo Hibernate `HHH90003004` (in-memory pagination khi dùng `Pageable` chung với `@EntityGraph`/fetch collection): bảo đảm truy vấn đếm (`countQuery`) và phân trang thực thi ở cấp SQL chính xác và tối ưu.
3. **Bảo toàn tương thích ngược:**
   - Giữ nguyên toàn bộ endpoint `List` cũ và action/state Redux cũ để không làm gãy `BranchEmployees.jsx`, `ReturnOrderPage.jsx`, `Transactions.jsx`, `CustomerDialog.jsx`, `CustomerLookupPage.jsx`.

---

## 5. Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] Backend cung cấp đầy đủ các endpoint `/paged` cho Orders và Customers với cấu trúc `PageResponse<T>`, mặc định `size = 10`, giới hạn tối đa `100`.
- [ ] `CustomerDTO` và `CustomerMapper` được tạo và sử dụng cho endpoint phân trang Khách hàng.
- [ ] Truy vấn lọc/tìm kiếm + phân trang của Orders và Customers thực thi hoàn toàn tại MySQL (không fetch toàn bộ bảng lên RAM, không lỗi `HHH90003004`).
- [ ] Phân quyền RBAC và Multi-Tenant Isolation được giữ nguyên đầy đủ trên các endpoint `/paged`.
- [ ] Giao diện Quản lý Đơn hàng Chi nhánh, Lịch sử Đơn hàng Thu ngân, và Quản lý Khách hàng hiển thị thanh phân trang, đổi được `10/20/50/100` dòng/trang, giữ bộ lọc khi chuyển trang và reset về trang đầu khi đổi bộ lọc/từ khóa.
- [ ] Các màn hình phụ dùng endpoint `List` cũ vẫn hoạt động bình thường.
- [ ] `pos-backend` biên dịch/chạy test thành công; `pos-frontend` build thành công không lỗi.
