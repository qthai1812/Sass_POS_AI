package com.zosh.controller;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.PageResponse;
import com.zosh.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    @PreAuthorize("hasRole('CASHIER')")
    @PostMapping
    public ResponseEntity<OrderDTO> createOrder(
            @RequestBody OrderDTO order) throws Exception {
        return ResponseEntity.ok(orderService.createOrder(order));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<OrderDTO> getOrderById(
            @PathVariable Long id) throws Exception {
        return ResponseEntity.ok(orderService.getOrderById(id));
    }

    @PreAuthorize("hasAnyRole('BRANCH_MANAGER', 'CASHIER')")
    @RequestMapping(value = "/{id}/status", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<OrderDTO> updateOrderStatus(
            @PathVariable Long id,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) PaymentType paymentType,
            @RequestParam(required = false) String paymentSessionId,
            @RequestBody(required = false) Map<String, String> body) throws Exception {
        OrderStatus effectiveStatus = status;
        if (effectiveStatus == null && body != null && body.get("status") != null) {
            effectiveStatus = OrderStatus.valueOf(body.get("status").trim().toUpperCase());
        }
        PaymentType effectivePaymentType = paymentType;
        if (effectivePaymentType == null && body != null && body.get("paymentType") != null) {
            effectivePaymentType = PaymentType.valueOf(body.get("paymentType").trim().toUpperCase());
        }
        String effectiveSessionId = paymentSessionId;
        if (effectiveSessionId == null && body != null && body.get("paymentSessionId") != null) {
            effectiveSessionId = body.get("paymentSessionId").trim();
        }
        return ResponseEntity.ok(orderService.updateOrderStatus(id, effectiveStatus, effectivePaymentType, effectiveSessionId));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}")
    public ResponseEntity<List<OrderDTO>> getOrderByBranch(
            @PathVariable Long branchId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long cashierId,
            @RequestParam(required = false) PaymentType paymentType,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) OrderStatus orderStatus) throws Exception {
        OrderStatus effectiveStatus = status != null ? status : orderStatus;
        return ResponseEntity.ok(orderService.getOrdersByBranch(branchId, customerId, cashierId, paymentType, effectiveStatus));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}/paged")
    public ResponseEntity<PageResponse<OrderDTO>> getOrderByBranchPaged(
            @PathVariable Long branchId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long cashierId,
            @RequestParam(required = false) PaymentType paymentType,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) OrderStatus orderStatus,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir) throws Exception {
        OrderStatus effectiveStatus = status != null ? status : orderStatus;
        return ResponseEntity.ok(orderService.getOrdersByBranchPaged(
                branchId, customerId, cashierId, paymentType, effectiveStatus, keyword, page, size, sortBy, sortDir
        ));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{id}")
    public ResponseEntity<List<OrderDTO>> getOrderByCashier(
            @PathVariable Long id) throws Exception {
        return ResponseEntity.ok(orderService.getOrderByCashier(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{id}/paged")
    public ResponseEntity<PageResponse<OrderDTO>> getOrderByCashierPaged(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir) throws Exception {
        return ResponseEntity.ok(orderService.getOrdersByCashierPaged(
                id, keyword, startDate, endDate, page, size, sortBy, sortDir
        ));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/today/branch/{id}")
    public ResponseEntity<List<OrderDTO>> getTodayOrder(
            @PathVariable Long id) throws Exception {
        return ResponseEntity.ok(orderService.getTodayOrdersByBranch(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/customer/{id}")
    public ResponseEntity<List<OrderDTO>> getCustomersOrder(
            @PathVariable Long id) throws Exception {
        return ResponseEntity.ok(orderService.getOrdersByCustomerId(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/recent/{branchId}")
    public ResponseEntity<List<OrderDTO>> getRecentOrder(
            @PathVariable Long branchId) throws Exception {
        return ResponseEntity.ok(orderService.getTop5RecentOrdersByBranchId(branchId));
    }

    @PreAuthorize("denyAll()")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteOrder(
            @PathVariable Long id) throws Exception {
        orderService.deleteOrder(id);
        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setMessage("Order deleted successfully");
        return ResponseEntity.ok(apiResponse);
    }

}
