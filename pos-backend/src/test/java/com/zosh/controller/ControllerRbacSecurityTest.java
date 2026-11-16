package com.zosh.controller;

import com.zosh.configuration.SecurityConfig;
import com.zosh.domain.OrderStatus;
import com.zosh.domain.StoreStatus;
import com.zosh.payload.dto.BranchTransferSummaryDTO;
import com.zosh.payload.dto.CustomerSummaryDTO;
import com.zosh.payload.dto.InventorySummaryDTO;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.dto.StoreSummaryDTO;
import com.zosh.payload.response.AiCopilotDTOs.AiInsightResponse;
import com.zosh.payload.response.AiCopilotDTOs.QuickCommandResponse;
import com.zosh.payload.response.BranchOverviewDTO;
import com.zosh.payload.response.PageResponse;
import com.zosh.payload.response.StoreOverviewDTO;
import com.zosh.repository.UserRepository;
import com.zosh.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        CustomerController.class,
        CouponController.class,
        OrderController.class,
        ProductController.class,
        RefundController.class,
        ShiftReportController.class,
        InventoryController.class,
        AiCopilotController.class,
        EmployeeController.class,
        BranchTransferRequestController.class,
        FileController.class,
        StoreAnalyticsController.class,
        BranchAnalyticsController.class,
        StoreController.class,
        SubscriptionController.class
})
@Import(SecurityConfig.class)
class ControllerRbacSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean private UserRepository userRepository;
    @MockitoBean private CustomerService customerService;
    @MockitoBean private CouponService couponService;
    @MockitoBean private OrderService orderService;
    @MockitoBean private ProductService productService;
    @MockitoBean private RefundService refundService;
    @MockitoBean private ShiftReportService shiftReportService;
    @MockitoBean private InventoryService inventoryService;
    @MockitoBean private AiCopilotService aiCopilotService;
    @MockitoBean private EmployeeService employeeService;
    @MockitoBean private BranchTransferRequestService transferRequestService;
    @MockitoBean private FileService fileService;
    @MockitoBean private StoreAnalyticsService storeAnalyticsService;
    @MockitoBean private BranchAnalyticsService branchAnalyticsService;
    @MockitoBean private StoreService storeService;
    @MockitoBean private SubscriptionService subscriptionService;
    @MockitoBean private UserService userService;

    // -------------------------------------------------------------------------
    // CustomerController: DELETE only STORE_OWNER, PUT only OWNER/BM
    // -------------------------------------------------------------------------
    @Test
    void customerEndpoints_enforceRoleBoundaries() throws Exception {
        mockMvc.perform(delete("/api/customers/1").with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/customers/1").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/customers/1").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/customers/1").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/customers/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/customers/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // Financial Deletes Locked (Option 2A): Order, Refund, ShiftReport
    // -------------------------------------------------------------------------
    @Test
    void financialDeleteEndpoints_denyAllRoles() throws Exception {
        for (String role : new String[]{"SUPER_ADMIN", "STORE_OWNER", "BRANCH_MANAGER", "CASHIER"}) {
            mockMvc.perform(delete("/api/orders/1").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/refunds/1").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/shift-reports/1").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
        }
    }

    // -------------------------------------------------------------------------
    // Option 1A + POS Shifts & Refunds: CASHIER-only
    // -------------------------------------------------------------------------
    @Test
    void posCreateOrderRefundAndShift_restrictedToCashierOnly() throws Exception {
        when(orderService.createOrder(any())).thenReturn(new OrderDTO());
        when(refundService.createRefund(any())).thenReturn(new RefundDTO());
        when(shiftReportService.startShift(any())).thenReturn(new ShiftReportDTO());

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/refunds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":1}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/refunds")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderId\":1}")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/shift-reports/start").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/shift-reports/start").with(user("c").roles("CASHIER")))
                .andExpect(status().isOk());

        when(orderService.updateOrderStatus(any(), any(), any(), any())).thenReturn(new OrderDTO());
        mockMvc.perform(patch("/api/orders/1/status").param("status", OrderStatus.CANCELLED.name())
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/orders/1/status").param("status", OrderStatus.CANCELLED.name())
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------------------------------
    // Coupons, Inventory & Transfers, Option 3A Employees, Transfers Requests
    // -------------------------------------------------------------------------
    @Test
    void retailOpsBoundaries_isolateStoreOwnerBranchManagerAndSuperAdmin() throws Exception {
        // Coupon creation: STORE_OWNER only
        mockMvc.perform(post("/api/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());

        // Super Admin isolated from retail catalog/customer/analytics
        mockMvc.perform(get("/api/customers").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/coupons/apply").param("code", "A").param("storeId", "1")
                        .with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/store/analytics/1/overview").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/branch-analytics/today-overview").param("branchId", "1")
                        .with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());

        // Inventory branch adjustment (BM only) vs inter-branch transfer (STORE_OWNER only)
        mockMvc.perform(post("/api/inventories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/inventories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/inventories/transfer")
                        .param("productId", "1").param("fromBranchId", "1").param("toBranchId", "2").param("quantity", "5")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/inventories/transfer")
                        .param("productId", "1").param("fromBranchId", "1").param("toBranchId", "2").param("quantity", "5")
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());

        // Option 3A: Employee creation & deletion only STORE_OWNER; BM can list branch employees & PUT status
        mockMvc.perform(post("/api/employees/branch/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/employees/5").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        when(employeeService.findBranchEmployees(1L, null)).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/api/employees/branch/1").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/employees/branch/1").with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // AI Copilot, Analytics, Media Upload & Store Moderation
    // -------------------------------------------------------------------------
    @Test
    void aiAnalyticsUploadAndModeration_enforceRoleHierarchy() throws Exception {
        when(aiCopilotService.analyzeStore(1L)).thenReturn(AiInsightResponse.builder().scope("STORE").build());
        when(aiCopilotService.analyzeBranch(1L)).thenReturn(AiInsightResponse.builder().scope("BRANCH").build());
        when(aiCopilotService.parseQuickOrderCommand(any())).thenReturn(QuickCommandResponse.builder().build());

        mockMvc.perform(get("/api/ai/store-insights/1").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/ai/store-insights/1").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/ai/store-insights/1").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/ai/branch-insights/1").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/ai/branch-insights/1").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/ai/pos/quick-command")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"command\":\"mua 1 ao\"}")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/ai/pos/quick-command")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"command\":\"mua 1 ao\"}")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isOk());

        // Media upload blocked for Cashier
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", new byte[]{1, 2});
        when(fileService.uploadFile(any())).thenReturn("http://localhost/test.png");
        mockMvc.perform(multipart("/api/media/upload").file(file).with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(multipart("/api/media/upload").file(file).with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());

        // Store analytics & branch analytics
        when(storeAnalyticsService.getStoreOverview(1L)).thenReturn(new StoreOverviewDTO());
        when(branchAnalyticsService.getTodayOverview(1L)).thenReturn(new BranchOverviewDTO());
        mockMvc.perform(get("/api/store/analytics/1/overview").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/branch-analytics/today-overview").param("branchId", "1")
                        .with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/branch-analytics/today-overview").param("branchId", "1")
                        .with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isOk());

        // Store moderate strictly SUPER_ADMIN; store POST strictly STORE_OWNER
        mockMvc.perform(put("/api/stores/1/moderate").param("status", StoreStatus.ACTIVE.name())
                        .with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/stores/1/moderate").param("status", StoreStatus.ACTIVE.name())
                        .with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/stores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------------------
    // Paginated Customer & Order Endpoints RBAC
    // -------------------------------------------------------------------------
    @Test
    void paginatedCustomerAndOrderEndpoints_enforceRoleBoundaries() throws Exception {
        when(customerService.getCustomersPaged(any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(customerService.getCustomerSummary()).thenReturn(new CustomerSummaryDTO(0, 0, 0));
        when(orderService.getOrdersByBranchPaged(any(), any(), any(), any(), any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(orderService.getOrdersByCashierPaged(any(), any(), any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));

        // Unauthenticated
        mockMvc.perform(get("/api/customers/paged")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/orders/branch/1/paged")).andExpect(status().isUnauthorized());

        // SUPER_ADMIN blocked from tenant operational tables
        mockMvc.perform(get("/api/customers/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/customers/summary").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/branch/1/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/cashier/1/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());

        // Store Owner, Branch Manager, Cashier allowed
        for (String role : new String[]{"STORE_OWNER", "BRANCH_MANAGER", "CASHIER"}) {
            mockMvc.perform(get("/api/customers/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/customers/summary").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/orders/branch/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/orders/cashier/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void phase2PaginatedEndpoints_enforceRoleBoundaries() throws Exception {
        when(productService.getProductsByStorePaged(any(), any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(inventoryService.getInventoryByBranchPaged(any(), any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(inventoryService.getInventorySummaryByBranch(any(), any(), any()))
                .thenReturn(new InventorySummaryDTO(0, 0, 0, 0));
        when(refundService.getRefundsByBranchPaged(any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(shiftReportService.getAllShiftReportsPaged(any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(shiftReportService.getShiftReportsByBranchIdPaged(any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(shiftReportService.getShiftReportsByCashierIdPaged(any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));

        // SUPER_ADMIN blocked
        mockMvc.perform(get("/api/products/store/1/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/inventories/branch/1/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/refunds/branch/1/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/shift-reports/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isForbidden());

        // /api/shift-reports/paged strictly STORE_OWNER
        mockMvc.perform(get("/api/shift-reports/paged").with(user("m").roles("BRANCH_MANAGER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/shift-reports/paged").with(user("c").roles("CASHIER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/shift-reports/paged").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());

        for (String role : new String[]{"STORE_OWNER", "BRANCH_MANAGER", "CASHIER"}) {
            mockMvc.perform(get("/api/products/store/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/inventories/branch/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/inventories/branch/1/summary").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/refunds/branch/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/shift-reports/branch/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/shift-reports/cashier/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void phase3PaginatedEndpoints_enforceRoleBoundaries() throws Exception {
        when(storeService.getAllStoresPaged(any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(storeService.getStoreSummary())
                .thenReturn(new StoreSummaryDTO());
        when(subscriptionService.getAllSubscriptionsPaged(any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(transferRequestService.getStoreRequestsPaged(any(), any(), any(Integer.class), any(Integer.class), any(), any()))
                .thenReturn(PageResponse.empty(0, 10));
        when(transferRequestService.getStoreRequestSummary(any()))
                .thenReturn(new BranchTransferSummaryDTO(0, 0));

        // Super Admin only: /api/stores/paged, /api/stores/summary, /api/subscriptions/admin/paged
        for (String role : new String[]{"STORE_OWNER", "BRANCH_MANAGER", "CASHIER"}) {
            mockMvc.perform(get("/api/stores/paged").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/stores/summary").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/subscriptions/admin/paged").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/stores/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/stores/summary").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/subscriptions/admin/paged").with(user("sa").roles("SUPER_ADMIN")))
                .andExpect(status().isOk());

        // Store Owner only: /api/branch-transfer-requests/store/1/paged & /summary
        for (String role : new String[]{"SUPER_ADMIN", "BRANCH_MANAGER", "CASHIER"}) {
            mockMvc.perform(get("/api/branch-transfer-requests/store/1/paged").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
            mockMvc.perform(get("/api/branch-transfer-requests/store/1/summary").with(user("u").roles(role)))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/api/branch-transfer-requests/store/1/paged").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/branch-transfer-requests/store/1/summary").with(user("o").roles("STORE_OWNER")))
                .andExpect(status().isOk());
    }
}
