package com.zosh.controller;

import com.zosh.domain.StoreStatus;
import com.zosh.exceptions.UserException;
import com.zosh.modal.User;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.StoreService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/stores")
public class StoreController {

    private final StoreService storeService;
    private final UserService userService;

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PostMapping
    public ResponseEntity<StoreDTO> createStore(
            @RequestBody StoreDTO storeDTO,
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws UserException {
        User user = (jwt != null && !jwt.isBlank())
                ? userService.getUserFromJwtToken(jwt)
                : userService.getCurrentUser();
        return ResponseEntity.ok(storeService.createStore(storeDTO, user));
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER')")
    @GetMapping
    public ResponseEntity<List<StoreDTO>> getAllStore(
            @RequestHeader(value = "Authorization", required = false) String jwt,
            @RequestParam(required = false) StoreStatus status
    ) throws Exception {
        return ResponseEntity.ok(storeService.getAllStores(status));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @GetMapping("/admin")
    public ResponseEntity<StoreDTO> getStoreByAdmin(
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws Exception {
        return ResponseEntity.ok(storeService.getStoreDtoByAdmin());
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/employee")
    public ResponseEntity<StoreDTO> getStoreByEmployee(
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws Exception {
        return ResponseEntity.ok(storeService.getStoreByEmployee());
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER')")
    @PutMapping("/{id}")
    public ResponseEntity<StoreDTO> updateStore(
            @PathVariable Long id,
            @RequestBody StoreDTO storeDTO
    ) throws Exception {
        return ResponseEntity.ok(storeService.updateStore(id, storeDTO));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/{id}/moderate")
    public ResponseEntity<StoreDTO> moderateStore(
            @PathVariable Long id,
            @RequestParam StoreStatus status,
            @RequestParam(required = false) String reason
    ) throws Exception {
        return ResponseEntity.ok(storeService.moderateStore(id, status, reason));
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<StoreDTO> getStoreById(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws Exception {
        return ResponseEntity.ok(storeService.getStoreById(id));
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'STORE_OWNER')")
    @DeleteMapping({"", "/{id}"})
    public ResponseEntity<ApiResponse> deleteStore(
            @PathVariable(required = false) Long id
    ) throws Exception {
        storeService.deleteStore(id);
        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setMessage("store deleted successfully");
        return ResponseEntity.ok(apiResponse);
    }
}
