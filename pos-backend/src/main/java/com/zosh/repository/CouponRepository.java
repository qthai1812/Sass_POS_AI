package com.zosh.repository;

import com.zosh.modal.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByCodeAndStoreId(String code, Long storeId);
    List<Coupon> findByStoreId(Long storeId);
}
