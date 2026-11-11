package com.zosh.controller;

import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.RefundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/refunds")
public class RefundController {

    private final RefundService refundService;

    @PreAuthorize("hasRole('CASHIER')")
    @PostMapping
    public ResponseEntity<RefundDTO> createRefund(@Valid @RequestBody RefundDTO refundDTO) throws Exception {
        RefundDTO refund = refundService.createRefund(refundDTO);
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping
    public ResponseEntity<List<RefundDTO>> getAllRefund() throws Exception {
        List<RefundDTO> refund = refundService.getAllRefunds();
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{cashierId}")
    public ResponseEntity<List<RefundDTO>> getRefundByCashier(
            @PathVariable Long cashierId
    ) throws Exception {
        List<RefundDTO> refund = refundService.getRefundByCashier(cashierId);
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}")
    public ResponseEntity<List<RefundDTO>> getRefundByBranch(
            @PathVariable Long branchId
    ) throws Exception {
        List<RefundDTO> refund = refundService.getRefundByBranch(branchId);
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<RefundDTO>> getRefundByOrder(
            @PathVariable Long orderId
    ) throws Exception {
        List<RefundDTO> refunds = refundService.getRefundsByOrderId(orderId);
        return ResponseEntity.ok(refunds);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/shift/{shiftId}")
    public ResponseEntity<List<RefundDTO>> getRefundByShift(
            @PathVariable Long shiftId
    ) throws Exception {
        List<RefundDTO> refund = refundService.getRefundByShiftReport(shiftId);
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{cashierId}/range")
    public ResponseEntity<List<RefundDTO>> getRefundByCashierAndDateRange(
            @PathVariable Long cashierId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate
    ) throws Exception {
        List<RefundDTO> refund = refundService.getRefundByCashierAndDateRange(
                cashierId, startDate, endDate
        );
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<RefundDTO> getRefundById(
            @PathVariable Long id
    ) throws Exception {
        RefundDTO refund = refundService.getRefundById(id);
        return ResponseEntity.ok(refund);
    }

    @PreAuthorize("denyAll()")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteRefund(
            @PathVariable Long id
    ) throws Exception {
        refundService.deleteRefund(id);
        ApiResponse res = new ApiResponse();
        res.setMessage("Refund deleted successfully");
        return ResponseEntity.ok(res);
    }
}