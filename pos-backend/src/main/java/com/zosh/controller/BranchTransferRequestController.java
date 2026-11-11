package com.zosh.controller;

import com.zosh.payload.dto.BranchTransferRequestDTO;
import com.zosh.service.BranchTransferRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/branch-transfer-requests")
@RequiredArgsConstructor
public class BranchTransferRequestController {

    private final BranchTransferRequestService transferRequestService;

    @PreAuthorize("hasAnyRole('BRANCH_MANAGER', 'CASHIER')")
    @PostMapping
    public ResponseEntity<BranchTransferRequestDTO> createRequest(
            @RequestBody Map<String, Object> body
    ) throws Exception {
        Long toBranchId = body.get("toBranchId") != null
                ? Long.valueOf(String.valueOf(body.get("toBranchId")))
                : null;
        String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : "";
        return ResponseEntity.ok(transferRequestService.createRequest(toBranchId, reason));
    }

    @PreAuthorize("hasAnyRole('BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/my")
    public ResponseEntity<List<BranchTransferRequestDTO>> getMyRequests() throws Exception {
        return ResponseEntity.ok(transferRequestService.getMyRequests());
    }

    @PreAuthorize("hasAnyRole('BRANCH_MANAGER', 'CASHIER')")
    @PutMapping("/{id}/cancel")
    public ResponseEntity<BranchTransferRequestDTO> cancelMyRequest(
            @PathVariable Long id
    ) throws Exception {
        return ResponseEntity.ok(transferRequestService.cancelMyRequest(id));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<BranchTransferRequestDTO>> getStoreRequests(
            @PathVariable Long storeId
    ) throws Exception {
        return ResponseEntity.ok(transferRequestService.getStoreRequests(storeId));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PutMapping("/{id}/review")
    public ResponseEntity<BranchTransferRequestDTO> reviewRequest(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) throws Exception {
        String action = body.getOrDefault("action", body.get("status"));
        String reviewNote = body.get("reviewNote");
        return ResponseEntity.ok(transferRequestService.reviewRequest(id, action, reviewNote));
    }
}
