package com.zosh.service.order;

import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Coupon;
import com.zosh.modal.Customer;
import com.zosh.modal.OrderItem;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Tính giá đơn hàng tại Server: tạm tính, chiết khấu (POINTS / Coupon / giảm tay) và thuế VAT.
 */
@Component
@RequiredArgsConstructor
public class OrderPricingCalculator {

    private static final double DEFAULT_TAX_RATE = 10.0;
    // Giới hạn chiết khấu trực tiếp (không có mã Coupon) của Thu ngân tối đa 10% (đặt = 0.0 nếu muốn cấm hoàn toàn)
    private static final double MAX_CASHIER_MANUAL_DISCOUNT_PERCENT = 10.0;

    private final CouponRepository couponRepository;

    /** Kết quả chiết khấu: số tiền giảm, mã hiển thị trên đơn, số điểm đã đổi. */
    public record DiscountResult(double amount, String appliedCode, int pointsUsed) {
        static DiscountResult none() {
            return new DiscountResult(0.0, null, 0);
        }
    }

    public double subTotal(List<OrderItem> items) {
        return items.stream().mapToDouble(OrderItem::getPrice).sum();
    }

    public DiscountResult computeDiscount(OrderDTO dto, double subTotal, Customer customer,
                                          Branch branch, User cashier) throws Exception {
        if (dto.getCouponCode() != null && !dto.getCouponCode().trim().isEmpty()) {
            String code = dto.getCouponCode().trim().toUpperCase();
            return code.startsWith("POINTS")
                    ? redeemPoints(customer, subTotal)
                    : applyCoupon(code, branch, subTotal);
        }
        if (dto.getDiscountAmount() != null && dto.getDiscountAmount() > 0) {
            return applyManualDiscount(dto.getDiscountAmount(), subTotal, cashier);
        }
        return DiscountResult.none();
    }

    /** Thuế VAT tính trên số tiền sau chiết khấu, theo store.taxRate (mặc định 10%), làm tròn 2 chữ số. */
    public double computeTax(double taxableAmount, Store store) {
        double rate = (store != null && store.getTaxRate() != null)
                ? Math.max(0.0, store.getTaxRate())
                : DEFAULT_TAX_RATE;
        return Math.round(taxableAmount * (rate / 100.0) * 100.0) / 100.0;
    }

    private DiscountResult redeemPoints(Customer customer, double subTotal) throws Exception {
        if (customer == null) {
            throw new Exception("Please select a customer to redeem loyalty points");
        }
        int availablePoints = customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
        if (availablePoints <= 0) {
            throw new Exception("Customer does not have any loyalty points to redeem");
        }
        int maxPointsUsable = (int) Math.floor(subTotal / CustomerLoyaltyService.VND_PER_POINT_REDEEMED);
        if (maxPointsUsable <= 0) {
            throw new Exception("Order subtotal must be at least 1,000 VND to redeem loyalty points");
        }
        int pointsUsed = Math.min(availablePoints, maxPointsUsable);
        return new DiscountResult(
                pointsUsed * CustomerLoyaltyService.VND_PER_POINT_REDEEMED,
                "POINTS (-" + pointsUsed + " pts)",
                pointsUsed);
    }

    private DiscountResult applyCoupon(String code, Branch branch, double subTotal) throws Exception {
        if (branch.getStore() == null) {
            throw new Exception("Branch does not belong to a valid store to apply coupon");
        }
        Coupon coupon = couponRepository.findByCodeAndStoreId(code, branch.getStore().getId())
                .orElseThrow(() -> new Exception("Invalid coupon code"));
        validateCoupon(coupon, subTotal);

        double discount = 0.0;
        if ("PERCENTAGE".equalsIgnoreCase(coupon.getDiscountType())) {
            discount = (subTotal * coupon.getDiscountValue()) / 100.0;
        } else if ("FLAT".equalsIgnoreCase(coupon.getDiscountType())) {
            discount = coupon.getDiscountValue();
        }
        return new DiscountResult(Math.min(discount, subTotal), coupon.getCode(), 0);
    }

    private void validateCoupon(Coupon coupon, double subTotal) throws Exception {
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
        if (coupon.getMinOrderValue() != null && subTotal < coupon.getMinOrderValue()) {
            throw new Exception("Order amount is below minimum required for this coupon");
        }
    }

    private DiscountResult applyManualDiscount(double requested, double subTotal, User cashier) {
        if (cashier.getRole() == UserRole.ROLE_CASHIER) {
            double maxAllowed = Math.round(subTotal * (MAX_CASHIER_MANUAL_DISCOUNT_PERCENT / 100.0));
            if (requested > maxAllowed + 0.01) {
                throw new AccessDeniedException(
                        "Thu ngân không được giảm giá trực tiếp vượt quá " + (int) MAX_CASHIER_MANUAL_DISCOUNT_PERCENT
                                + "% tổng đơn khi không có mã Coupon hợp lệ."
                );
            }
        }
        return new DiscountResult(Math.min(requested, subTotal), null, 0);
    }
}
