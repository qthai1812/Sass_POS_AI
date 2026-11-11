package com.zosh.service.order;

import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.repository.CouponRepository;
import com.zosh.service.order.OrderPricingCalculator.DiscountResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderPricingCalculatorTest {

    @Mock
    private CouponRepository couponRepository;

    @InjectMocks
    private OrderPricingCalculator calculator;

    private Store store;
    private Branch branch;
    private User cashier;
    private User owner;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(10L);
        store.setTaxRate(8.0);
        branch = Branch.builder().id(20L).store(store).build();
        cashier = new User();
        cashier.setId(1L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        owner = new User();
        owner.setId(2L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
    }

    @Test
    void subTotal_sumsAllOrderItems() {
        List<OrderItem> items = List.of(
                OrderItem.builder().price(100000.0).build(),
                OrderItem.builder().price(55000.0).build()
        );
        assertEquals(155000.0, calculator.subTotal(items));
    }

    @Test
    void computeDiscount_pointsRedemption_capsAtAvailablePointsAndSubtotal() throws Exception {
        Customer customer = Customer.builder().id(5L).loyaltyPoints(120).build();
        OrderDTO dto = OrderDTO.builder().couponCode("points").build();

        // subTotal = 50,500 -> max usable = 50 pts -> discount = 50,000
        DiscountResult result = calculator.computeDiscount(dto, 50500.0, customer, branch, cashier);

        assertEquals(50000.0, result.amount());
        assertEquals("POINTS (-50 pts)", result.appliedCode());
        assertEquals(50, result.pointsUsed());
    }

    @Test
    void computeDiscount_pointsRedemption_throwsWhenNoCustomerOrZeroPoints() {
        OrderDTO dto = OrderDTO.builder().couponCode("POINTS").build();
        assertThrows(Exception.class, () -> calculator.computeDiscount(dto, 50000.0, null, branch, cashier));

        Customer emptyCustomer = Customer.builder().loyaltyPoints(0).build();
        assertThrows(Exception.class, () -> calculator.computeDiscount(dto, 50000.0, emptyCustomer, branch, cashier));
    }

    @Test
    void computeDiscount_couponPercentageAndFlat_calculatesCorrectly() throws Exception {
        Coupon pctCoupon = Coupon.builder()
                .code("SALE15")
                .discountType("PERCENTAGE")
                .discountValue(15.0)
                .isActive(true)
                .validFrom(LocalDateTime.now().minusDays(1))
                .validUntil(LocalDateTime.now().plusDays(1))
                .minOrderValue(100000.0)
                .build();
        when(couponRepository.findByCodeAndStoreId("SALE15", 10L)).thenReturn(Optional.of(pctCoupon));

        DiscountResult pctResult = calculator.computeDiscount(
                OrderDTO.builder().couponCode("sale15").build(), 200000.0, null, branch, cashier);
        assertEquals(30000.0, pctResult.amount());
        assertEquals("SALE15", pctResult.appliedCode());
        assertEquals(0, pctResult.pointsUsed());

        Coupon flatCoupon = Coupon.builder()
                .code("FLAT500K")
                .discountType("FLAT")
                .discountValue(500000.0)
                .isActive(true)
                .build();
        when(couponRepository.findByCodeAndStoreId("FLAT500K", 10L)).thenReturn(Optional.of(flatCoupon));

        DiscountResult flatResult = calculator.computeDiscount(
                OrderDTO.builder().couponCode("FLAT500K").build(), 200000.0, null, branch, cashier);
        assertEquals(200000.0, flatResult.amount()); // Capped at subTotal
    }

    @Test
    void computeDiscount_couponValidation_rejectsExpiredOrBelowMinOrder() {
        Coupon expired = Coupon.builder()
                .code("OLD")
                .discountType("FLAT")
                .discountValue(10000.0)
                .isActive(true)
                .validUntil(LocalDateTime.now().minusMinutes(5))
                .build();
        when(couponRepository.findByCodeAndStoreId("OLD", 10L)).thenReturn(Optional.of(expired));

        Exception ex = assertThrows(Exception.class, () -> calculator.computeDiscount(
                OrderDTO.builder().couponCode("OLD").build(), 100000.0, null, branch, cashier));
        assertTrue(ex.getMessage().contains("expired"));
    }

    @Test
    void computeDiscount_manualDiscount_enforces10PercentCapOnlyForCashier() throws Exception {
        // 15,000 on 100,000 = 15% -> blocked for cashier
        OrderDTO dto = OrderDTO.builder().discountAmount(15000.0).build();
        assertThrows(AccessDeniedException.class,
                () -> calculator.computeDiscount(dto, 100000.0, null, branch, cashier));

        // 10,000 on 100,000 = 10% -> allowed for cashier
        DiscountResult cashierOk = calculator.computeDiscount(
                OrderDTO.builder().discountAmount(10000.0).build(), 100000.0, null, branch, cashier);
        assertEquals(10000.0, cashierOk.amount());

        // 15% allowed for store owner
        DiscountResult ownerOk = calculator.computeDiscount(dto, 100000.0, null, branch, owner);
        assertEquals(15000.0, ownerOk.amount());
    }

    @Test
    void computeTax_usesStoreRateOrDefault10Percent() {
        assertEquals(8000.0, calculator.computeTax(100000.0, store));
        Store nullRateStore = new Store();
        nullRateStore.setTaxRate(null);
        assertEquals(10000.0, calculator.computeTax(100000.0, nullRateStore));
        Store negativeRateStore = new Store();
        negativeRateStore.setTaxRate(-5.0);
        assertEquals(0.0, calculator.computeTax(100000.0, negativeRateStore));
    }
}
