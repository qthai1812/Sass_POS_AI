package com.zosh.service.order;

import com.zosh.modal.Customer;
import com.zosh.modal.Order;
import com.zosh.modal.Refund;
import com.zosh.repository.CustomerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerLoyaltyServiceTest {

    @Mock
    private CustomerRepository customerRepository;

    @InjectMocks
    private CustomerLoyaltyService loyaltyService;

    @Test
    void earnedPointsFor_floorsPer10000Vnd() {
        assertEquals(0, loyaltyService.earnedPointsFor(9999.0));
        assertEquals(1, loyaltyService.earnedPointsFor(10000.0));
        assertEquals(2, loyaltyService.earnedPointsFor(29999.0));
    }

    @Test
    void extractPointsUsed_parsesPointsCouponFormat() {
        assertEquals(0, loyaltyService.extractPointsUsed(Order.builder().couponCode(null).build()));
        assertEquals(0, loyaltyService.extractPointsUsed(Order.builder().couponCode("SALE10").build()));
        assertEquals(15, loyaltyService.extractPointsUsed(Order.builder().couponCode("POINTS (-15 pts)").build()));
    }

    @Test
    void applyForNewOrder_completedOrder_deductsUsedAndAwardsEarned() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(50).build();
        when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        Customer saved = loyaltyService.applyForNewOrder(customer, true, 125000.0, 20);

        assertNotNull(saved);
        // 50 - 20 + floor(125000 / 10000) = 42
        assertEquals(42, saved.getLoyaltyPoints());
        verify(customerRepository).save(customer);
    }

    @Test
    void applyForNewOrder_pendingOrderWithPointsUsed_onlyDeductsUsed() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(30).build();
        when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        Customer saved = loyaltyService.applyForNewOrder(customer, false, 100000.0, 10);

        assertNotNull(saved);
        assertEquals(20, saved.getLoyaltyPoints());
        verify(customerRepository).save(customer);
    }

    @Test
    void applyForNewOrder_pendingOrderNoPointsUsed_doesNotSave() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(30).build();

        Customer result = loyaltyService.applyForNewOrder(customer, false, 100000.0, 0);

        assertNull(result);
        verify(customerRepository, never()).save(any());
    }

    @Test
    void revertRemaining_restoresUsedAndDeductsOnlyRemainingEarned() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(10).build();
        Order order = Order.builder()
                .customer(customer)
                .totalAmount(55000.0) // totalEarned = 5
                .couponCode("POINTS (-3 pts)")
                .build();
        // prior refund = 22000 -> already deducted = 2 -> remaining to deduct = 3
        List<Refund> priorRefunds = List.of(Refund.builder().amount(22000.0).build());
        when(customerRepository.findByIdWithLock(1L)).thenReturn(Optional.of(customer));

        loyaltyService.revertRemaining(order, priorRefunds);

        // 10 + 3 (used) - 3 (remaining earned) = 10 -> unchanged, no save needed
        assertEquals(10, customer.getLoyaltyPoints());
        verify(customerRepository, never()).save(any());
    }

    @Test
    void applyForRefund_cumulativeFloorPreventsRoundingLossAcrossMultiplePartialRefunds() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(10).build();
        Order order = Order.builder()
                .customer(customer)
                .totalAmount(25000.0) // 2 earned points
                .couponCode("POINTS (-4 pts)")
                .build();
        when(customerRepository.findByIdWithLock(1L)).thenReturn(Optional.of(customer));

        // First partial refund: 8,000 VND (cumulative deducted 0 -> 0, cumulative restored floor(4 * 8/25)=1)
        loyaltyService.applyForRefund(order, 25000.0, 0.0, 8000.0, false);
        assertEquals(11, customer.getLoyaltyPoints());

        // Second partial refund: +8,000 VND (total 16,000 -> deducted floor(16/10)=1, restored floor(4*16/25)=2 -> +1 - 1 = 0 change)
        loyaltyService.applyForRefund(order, 25000.0, 8000.0, 16000.0, false);
        assertEquals(11, customer.getLoyaltyPoints());

        // Final full refund: 25,000 -> total deducted 2 (+1), total restored 4 (+2) => net +1 -> 12
        loyaltyService.applyForRefund(order, 25000.0, 16000.0, 25000.0, true);
        assertEquals(12, customer.getLoyaltyPoints());
    }

    @Test
    void reverseForDeletedRefund_reversesPointsAdjustment() {
        Customer customer = Customer.builder().id(1L).loyaltyPoints(12).build();
        Order order = Order.builder()
                .customer(customer)
                .totalAmount(25000.0)
                .couponCode("POINTS (-4 pts)")
                .build();
        when(customerRepository.findByIdWithLock(1L)).thenReturn(Optional.of(customer));

        // Deleting full refund when order was REFUNDED and reopens to PARTIALLY_REFUNDED (remainingRefunded = 16000)
        // deductedBeforeDelete = 2, deductedAfterDelete = 1 -> +1 earned back; reopened -> -4 used points
        loyaltyService.reverseForDeletedRefund(order, 25000.0, 16000.0, 9000.0, true, true);

        // 12 - 4 + 1 = 9
        assertEquals(9, customer.getLoyaltyPoints());
        verify(customerRepository).save(customer);
    }
}
