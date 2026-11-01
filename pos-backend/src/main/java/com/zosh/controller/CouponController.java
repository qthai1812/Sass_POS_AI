package com.zosh.controller;

import com.zosh.payload.dto.CouponDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @PostMapping
    public ResponseEntity<CouponDTO> createCoupon(@RequestBody CouponDTO couponDTO) throws Exception {
        return ResponseEntity.ok(couponService.createCoupon(couponDTO));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CouponDTO> getCouponById(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(couponService.getCouponById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CouponDTO> updateCoupon(@PathVariable Long id, @RequestBody CouponDTO couponDTO) throws Exception {
        return ResponseEntity.ok(couponService.updateCoupon(id, couponDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteCoupon(@PathVariable Long id) throws Exception {
        couponService.deleteCoupon(id);
        ApiResponse response = new ApiResponse();
        response.setMessage("Coupon deleted successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<CouponDTO>> getCouponsByStore(@PathVariable Long storeId) throws Exception {
        return ResponseEntity.ok(couponService.getCouponsByStoreId(storeId));
    }

    @GetMapping("/apply")
    public ResponseEntity<CouponDTO> applyCoupon(
            @RequestParam String code,
            @RequestParam Long storeId) throws Exception {
        return ResponseEntity.ok(couponService.getCouponByCode(code, storeId));
    }
}
