package com.zosh.service;

import com.zosh.payload.dto.CouponDTO;
import java.util.List;

public interface CouponService {
    CouponDTO createCoupon(CouponDTO couponDTO) throws Exception;
    CouponDTO updateCoupon(Long id, CouponDTO couponDTO) throws Exception;
    void deleteCoupon(Long id) throws Exception;
    CouponDTO getCouponById(Long id) throws Exception;
    List<CouponDTO> getCouponsByStoreId(Long storeId) throws Exception;
    CouponDTO getCouponByCode(String code, Long storeId) throws Exception;
}
