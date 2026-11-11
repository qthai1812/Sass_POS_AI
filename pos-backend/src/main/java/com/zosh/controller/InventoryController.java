package com.zosh.controller;

import com.zosh.payload.dto.InventoryDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/inventories")
public class InventoryController {

    private final InventoryService inventoryService;

    @PreAuthorize("hasRole('BRANCH_MANAGER')")
    @PostMapping
    public ResponseEntity<InventoryDTO> create(
            @RequestBody InventoryDTO inventoryDTO
    ) throws Exception {
        return ResponseEntity.ok(inventoryService.createInventory(inventoryDTO));
    }

    @PreAuthorize("hasRole('BRANCH_MANAGER')")
    @PutMapping("/{id}")
    public ResponseEntity<InventoryDTO> update(
            @RequestBody InventoryDTO inventoryDTO,
            @PathVariable Long id
    ) throws Exception {
        return ResponseEntity.ok(inventoryService.updateInventory(id, inventoryDTO));
    }

    @PreAuthorize("hasRole('BRANCH_MANAGER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> delete(
            @PathVariable Long id
    ) throws Exception {
        inventoryService.deleteInventory(id);
        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setMessage("Inventory deleted successfully");
        return ResponseEntity.ok(apiResponse);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<InventoryDTO> getInventoryById(
            @PathVariable Long id
    ) throws Exception {
        return ResponseEntity.ok(inventoryService.getInventoryById(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}/product/{productId}")
    public ResponseEntity<InventoryDTO> getInventoryByProductAndBranchId(
            @PathVariable Long branchId,
            @PathVariable Long productId
    ) throws Exception {
        return ResponseEntity.ok(inventoryService
                .getInventoryByProductIdAndBranchId(productId, branchId));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/product/{productId}")
    public ResponseEntity<List<InventoryDTO>> getInventoryByProduct(
            @PathVariable Long productId
    ) {
        return ResponseEntity.ok(inventoryService.getInventoryByProductId(productId));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}")
    public ResponseEntity<List<InventoryDTO>> getInventoryByBranch(
            @PathVariable Long branchId
    ) throws Exception {
        return ResponseEntity.ok(inventoryService.getAllInventoryByBranchId(branchId));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PostMapping("/transfer")
    public ResponseEntity<ApiResponse> transferInventory(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long fromBranchId,
            @RequestParam(required = false) Long toBranchId,
            @RequestParam(required = false) Integer quantity,
            @RequestBody(required = false) Map<String, Object> body
    ) throws Exception {
        Long pId = productId;
        Long fromB = fromBranchId;
        Long toB = toBranchId;
        Integer qty = quantity;
        if (body != null) {
            if (pId == null && body.get("productId") != null) {
                pId = Long.valueOf(body.get("productId").toString());
            }
            if (fromB == null && body.get("fromBranchId") != null) {
                fromB = Long.valueOf(body.get("fromBranchId").toString());
            }
            if (toB == null && body.get("toBranchId") != null) {
                toB = Long.valueOf(body.get("toBranchId").toString());
            }
            if (qty == null && body.get("quantity") != null) {
                qty = Integer.valueOf(body.get("quantity").toString());
            }
        }
        if (pId == null || fromB == null || toB == null || qty == null) {
            throw new IllegalArgumentException("productId, fromBranchId, toBranchId, quantity are required");
        }
        inventoryService.transferInventory(pId, fromB, toB, qty);
        ApiResponse res = new ApiResponse();
        res.setMessage("Inventory transferred successfully");
        return ResponseEntity.ok(res);
    }
}
