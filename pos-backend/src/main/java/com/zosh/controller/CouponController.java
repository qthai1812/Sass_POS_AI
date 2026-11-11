package com.zosh.controller;

import com.zosh.payload.dto.CouponDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PostMapping
    public ResponseEntity<CouponDTO> createCoupon(@RequestBody CouponDTO couponDTO) throws Exception {
        return ResponseEntity.ok(couponService.createCoupon(couponDTO));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<CouponDTO> getCouponById(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(couponService.getCouponById(id));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PutMapping("/{id}")
    public ResponseEntity<CouponDTO> updateCoupon(@PathVariable Long id, @RequestBody CouponDTO couponDTO) throws Exception {
        return ResponseEntity.ok(couponService.updateCoupon(id, couponDTO));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteCoupon(@PathVariable Long id) throws Exception {
        couponService.deleteCoupon(id);
        ApiResponse response = new ApiResponse();
        response.setMessage("Coupon deleted successfully");
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<CouponDTO>> getCouponsByStore(@PathVariable Long storeId) throws Exception {
        return ResponseEntity.ok(couponService.getCouponsByStoreId(storeId));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/apply")
    public ResponseEntity<CouponDTO> applyCoupon(
            @RequestParam String code,
            @RequestParam Long storeId) throws Exception {
        return ResponseEntity.ok(couponService.getCouponByCode(code, storeId));
    }
}
