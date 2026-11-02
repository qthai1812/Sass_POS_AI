package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.modal.Coupon;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.CouponDTO;
import com.zosh.repository.CouponRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.CouponService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CouponServiceImpl implements CouponService {

    private final CouponRepository couponRepository;
    private final StoreRepository storeRepository;
    private final UserService userService;

    private CouponDTO mapToDto(Coupon coupon) {
        return CouponDTO.builder()
                .id(coupon.getId())
                .code(coupon.getCode())
                .discountType(coupon.getDiscountType())
                .discountValue(coupon.getDiscountValue())
                .minOrderValue(coupon.getMinOrderValue())
                .validFrom(coupon.getValidFrom())
                .validUntil(coupon.getValidUntil())
                .isActive(coupon.getIsActive())
                .storeId(coupon.getStore() != null ? coupon.getStore().getId() : null)
                .build();
    }

    private void validateCouponStoreReadAccess(Store store) throws Exception {
        User user = userService.getCurrentUser();
        if (user.getRole() == UserRole.ROLE_ADMIN) return;
        if (store == null) {
            throw new Exception("You do not have permission to view coupons for this store");
        }
        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isStoreUser = user.getStore() != null && user.getStore().getId().equals(store.getId());
        boolean isBranchUser = user.getBranch() != null
                && user.getBranch().getStore() != null
                && user.getBranch().getStore().getId().equals(store.getId());
        if (!isOwner && !isStoreUser && !isBranchUser) {
            throw new Exception("You do not have permission to view coupons for this store");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public CouponDTO getCouponById(Long id) throws Exception {
        Coupon coupon = couponRepository.findById(id).orElseThrow(() -> new Exception("Coupon not found"));
        validateCouponStoreReadAccess(coupon.getStore());
        return mapToDto(coupon);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CouponDTO> getCouponsByStoreId(Long storeId) throws Exception {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new Exception("Store not found"));
        validateCouponStoreReadAccess(store);
        return couponRepository.findByStoreId(storeId).stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CouponDTO getCouponByCode(String code, Long storeId) throws Exception {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Coupon code is required");
        }
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new Exception("Store not found"));
        validateCouponStoreReadAccess(store);

        if ("POINTS".equalsIgnoreCase(code.trim())) {
            return CouponDTO.builder()
                    .id(0L)
                    .code("POINTS")
                    .discountType("FLAT")
                    .discountValue(0.0)
                    .minOrderValue(0.0)
                    .isActive(true)
                    .storeId(storeId)
                    .build();
        }

        Coupon coupon = couponRepository.findByCodeAndStoreId(code.trim().toUpperCase(), storeId)
                .orElseThrow(() -> new Exception("Invalid coupon code"));

        LocalDateTime now = LocalDateTime.now();
        if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
            throw new Exception("Coupon is not active yet");
        }
        if (coupon.getValidUntil() != null && now.isAfter(coupon.getValidUntil())) {
            throw new Exception("Coupon is expired");
        }
        if (Boolean.FALSE.equals(coupon.getIsActive())) {
            throw new Exception("Coupon is disabled");
        }
        return mapToDto(coupon);
    }


    /// /////////////////////////////////////////

    private void validateCouponStoreAccess(Store store) throws Exception {
        User user = userService.getCurrentUser();
        if (user.getRole() == UserRole.ROLE_ADMIN) return;
        if (store == null) {
            throw new Exception("You do not have permission to manage coupons for this store");
        }
        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isManager = user.getStore() != null && user.getStore().getId().equals(store.getId())
                && (user.getRole() == UserRole.ROLE_STORE_ADMIN || user.getRole() == UserRole.ROLE_STORE_MANAGER);
        if (!isOwner && !isManager) {
            throw new Exception("You do not have permission to manage coupons for this store");
        }
    }

    private void validateCouponValues(String code, String discountType, Double discountValue) throws Exception {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Coupon code is required");
        }
        if (code.trim().toUpperCase().startsWith("POINTS")) {
            throw new IllegalArgumentException("Coupon code 'POINTS' is reserved for loyalty point redemption");
        }
        if (discountValue == null || discountValue <= 0) {
            throw new IllegalArgumentException("Discount value must be greater than 0");
        }
        if ("PERCENTAGE".equalsIgnoreCase(discountType) && discountValue > 100) {
            throw new IllegalArgumentException("Percentage discount cannot exceed 100%");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CouponDTO createCoupon(CouponDTO dto) throws Exception {
        if (dto.getStoreId() == null) {
            throw new IllegalArgumentException("Store ID is required");
        }
        Store store = storeRepository.findById(dto.getStoreId())
                .orElseThrow(() -> new Exception("Store not found"));
        validateCouponStoreAccess(store);
        validateCouponValues(dto.getCode(), dto.getDiscountType(), dto.getDiscountValue());
        if (dto.getValidFrom() != null && dto.getValidUntil() != null
                && dto.getValidFrom().isAfter(dto.getValidUntil())) {
            throw new IllegalArgumentException("Valid-from date must be before valid-until date");
        }

        String normalizedCode = dto.getCode().trim().toUpperCase();
        if (couponRepository.findByCodeAndStoreId(normalizedCode, store.getId()).isPresent()) {
            throw new Exception("Coupon code already exists in this store");
        }

        Coupon coupon = Coupon.builder()
                .code(normalizedCode)
                .discountType(dto.getDiscountType())
                .discountValue(dto.getDiscountValue())
                .minOrderValue(dto.getMinOrderValue())
                .validFrom(dto.getValidFrom())
                .validUntil(dto.getValidUntil())
                .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
                .store(store)
                .build();
        return mapToDto(couponRepository.save(coupon));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CouponDTO updateCoupon(Long id, CouponDTO dto) throws Exception {
        Coupon coupon = couponRepository.findById(id).orElseThrow(() -> new Exception("Coupon not found"));
        validateCouponStoreAccess(coupon.getStore());

        if (dto.getCode() != null && !dto.getCode().trim().isEmpty()) {
            String normalized = dto.getCode().trim().toUpperCase();
            if (!normalized.equalsIgnoreCase(coupon.getCode())
                    && coupon.getStore() != null
                    && couponRepository.findByCodeAndStoreId(normalized, coupon.getStore().getId()).isPresent()) {
                throw new Exception("Coupon code already exists in this store");
            }
            coupon.setCode(normalized);
        }
        if (dto.getDiscountType() != null) coupon.setDiscountType(dto.getDiscountType());
        if (dto.getDiscountValue() != null) coupon.setDiscountValue(dto.getDiscountValue());
        validateCouponValues(coupon.getCode(), coupon.getDiscountType(), coupon.getDiscountValue());
        if (dto.getValidFrom() != null && dto.getValidUntil() != null
                && dto.getValidFrom().isAfter(dto.getValidUntil())) {
            throw new IllegalArgumentException("Valid-from date must be before valid-until date");
        }

        if (dto.getMinOrderValue() != null) coupon.setMinOrderValue(dto.getMinOrderValue());
        if (dto.getValidFrom() != null) coupon.setValidFrom(dto.getValidFrom());
        if (dto.getValidUntil() != null) coupon.setValidUntil(dto.getValidUntil());
        if (dto.getIsActive() != null) coupon.setIsActive(dto.getIsActive());

        return mapToDto(couponRepository.save(coupon));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteCoupon(Long id) throws Exception {
        Coupon coupon = couponRepository.findById(id).orElseThrow(() -> new Exception("Coupon not found"));
        validateCouponStoreAccess(coupon.getStore());
        couponRepository.delete(coupon);
    }
}
