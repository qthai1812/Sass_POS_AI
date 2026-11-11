package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.dto.RefundItemDTO;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.UserService;
import com.zosh.service.order.CustomerLoyaltyService;
import com.zosh.service.order.OrderInventoryCoordinator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefundServiceImplTest {

    @Mock private UserService userService;
    @Mock private OrderRepository orderRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private AccessControlService accessControl;
    @Mock private OrderInventoryCoordinator inventoryCoordinator;
    @Mock private CustomerLoyaltyService loyaltyService;

    @InjectMocks
    private RefundServiceImpl refundService;

    private Branch branch;
    private User cashier;
    private ShiftReport activeShift;
    private Product product1;
    private Product product2;
    private Order completedOrder;

    @BeforeEach
    void setUp() {
        branch = Branch.builder().id(10L).build();
        cashier = new User();
        cashier.setId(100L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setBranch(branch);
        activeShift = ShiftReport.builder().id(200L).cashier(cashier).branch(branch).build();

        product1 = Product.builder().id(1L).name("T-Shirt").sellingPrice(100000.0).build();
        product2 = Product.builder().id(2L).name("Jeans").sellingPrice(200000.0).build();

        OrderItem item1 = OrderItem.builder().id(11L).product(product1).quantity(2).price(200000.0).build();
        OrderItem item2 = OrderItem.builder().id(12L).product(product2).quantity(1).price(200000.0).build();

        // subTotal = 400,000; tax 10% = 40,000 => totalAmount = 440,000 (netOrderFactor = 1.1)
        completedOrder = Order.builder()
                .id(500L)
                .branch(branch)
                .cashier(cashier)
                .status(OrderStatus.COMPLETED)
                .paymentType(PaymentType.CASH)
                .subTotal(400000.0)
                .totalAmount(440000.0)
                .items(List.of(item1, item2))
                .build();
    }

    @Test
    void createRefund_cancelledOrder_throwsException() throws Exception {
        completedOrder.setStatus(OrderStatus.CANCELLED);
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));

        RefundDTO req = RefundDTO.builder().orderId(500L).build();
        Exception ex = assertThrows(Exception.class, () -> refundService.createRefund(req));
        assertTrue(ex.getMessage().contains("cancelled"));
    }

    @Test
    void createRefund_cashierWithoutShift_throwsException() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());

        RefundDTO req = RefundDTO.builder().orderId(500L).build();
        Exception ex = assertThrows(Exception.class, () -> refundService.createRefund(req));
        assertTrue(ex.getMessage().contains("Start Shift"));
        verify(shiftReportRepository, never()).findByBranchId(anyLong());
    }

    @Test
    void createRefund_cashierWithoutOwnShift_evenWhenAnotherCashierHasOpenShift_throwsException() throws Exception {
        User otherCashier = new User();
        otherCashier.setId(999L);
        otherCashier.setRole(UserRole.ROLE_CASHIER);
        otherCashier.setBranch(branch);
        completedOrder.setCashier(otherCashier);

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());

        RefundDTO req = RefundDTO.builder()
                .orderId(500L)
                .items(List.of(RefundItemDTO.builder().orderItemId(11L).quantity(1).build()))
                .build();

        Exception ex = assertThrows(Exception.class, () -> refundService.createRefund(req));
        assertTrue(ex.getMessage().contains("Start Shift"));
        verify(inventoryCoordinator, never()).restoreByProduct(anyMap(), anyLong(), anyLong());
    }

    @Test
    void createRefund_nullOrderId_throwsIllegalArgument() {
        RefundDTO req = RefundDTO.builder().amount(50000.0).build();
        assertThrows(IllegalArgumentException.class, () -> refundService.createRefund(req));
    }

    @Test
    void createRefund_mismatchedBranchId_throwsIllegalArgument() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));

        RefundDTO req = RefundDTO.builder().orderId(500L).branchId(99L).build();
        assertThrows(IllegalArgumentException.class, () -> refundService.createRefund(req));
    }

    @Test
    void createRefund_discountedTaxedOrder_multiStepPartialRefund_handlesRoundingAndMatchesFinalRemaining() throws Exception {
        Product p1 = Product.builder().id(1L).name("Shirt").sellingPrice(100000.0).build();
        Product p2 = Product.builder().id(2L).name("Pants").sellingPrice(200000.0).build();
        OrderItem oi1 = OrderItem.builder().id(21L).product(p1).quantity(3).price(300000.0).build();
        OrderItem oi2 = OrderItem.builder().id(22L).product(p2).quantity(1).price(200000.0).build();
        // subTotal = 500,000; discount = 50,000 => taxable = 450,000; tax 10% = 45,000 => total = 495,000 (factor = 0.99)
        // Suppose odd factor: subTotal = 300,000; total = 329,999.99 (or odd ratio causing .01 rounding drift)
        OrderItem oiOdd1 = OrderItem.builder().id(31L).product(p1).quantity(2).price(200000.0).build();
        OrderItem oiOdd2 = OrderItem.builder().id(32L).product(p2).quantity(1).price(100000.0).build();
        Order oddOrder = Order.builder()
                .id(600L)
                .branch(branch)
                .cashier(cashier)
                .status(OrderStatus.COMPLETED)
                .paymentType(PaymentType.CASH)
                .subTotal(300000.0)
                .totalAmount(329000.0) // factor = 329000/300000 = 1.0966666...
                .items(List.of(oiOdd1, oiOdd2))
                .build();

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(600L)).thenReturn(Optional.of(oddOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> {
            Refund r = inv.getArgument(0);
            if (r.getId() == null) r.setId(950L);
            return r;
        });

        // Step 1: return 1 unit of oiOdd1 (~109,666.67)
        when(refundRepository.findByOrderId(600L)).thenReturn(Collections.emptyList());
        RefundDTO step1 = refundService.createRefund(RefundDTO.builder()
                .orderId(600L)
                .reason("Wrong size")
                .items(List.of(RefundItemDTO.builder().orderItemId(31L).quantity(1).build()))
                .build());
        assertEquals(109666.67, step1.getAmount(), 0.01);
        assertEquals(OrderStatus.PARTIALLY_REFUNDED, oddOrder.getStatus());

        // Step 2: return remaining 1 unit of oiOdd1 + 1 unit of oiOdd2 -> absorbs rounding delta so final closes cleanly at 329,000
        Refund prior = Refund.builder()
                .id(950L)
                .amount(step1.getAmount())
                .items(List.of(RefundItem.builder().orderItemId(31L).productId(1L).quantity(1).build()))
                .build();
        when(refundRepository.findByOrderId(600L)).thenReturn(List.of(prior));
        RefundDTO step2 = refundService.createRefund(RefundDTO.builder()
                .orderId(600L)
                .reason("Remaining return")
                .items(List.of(
                        RefundItemDTO.builder().orderItemId(31L).quantity(1).build(),
                        RefundItemDTO.builder().orderItemId(32L).quantity(1).build()
                ))
                .build());

        assertEquals(219333.33, step2.getAmount(), 0.01);
        assertEquals(329000.0, step1.getAmount() + step2.getAmount(), 0.01);
        assertEquals(OrderStatus.REFUNDED, oddOrder.getStatus());
        double lineSum = step2.getItems().stream().mapToDouble(RefundItemDTO::getRefundAmount).sum();
        assertEquals(step2.getAmount(), lineSum, 0.01);
    }

    @Test
    void createRefund_allItemsReturnedWithFee_thenAmountRefundClosesOrder() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> {
            Refund r = inv.getArgument(0);
            if (r.getId() == null) r.setId(960L);
            return r;
        });

        // Step 1: return all items (440k value) minus 40k restocking fee => 400k
        when(refundRepository.findByOrderId(500L)).thenReturn(Collections.emptyList());
        RefundDTO step1 = refundService.createRefund(RefundDTO.builder()
                .orderId(500L)
                .amount(400000.0)
                .reason("Opened packaging fee")
                .items(List.of(
                        RefundItemDTO.builder().orderItemId(11L).quantity(2).build(),
                        RefundItemDTO.builder().orderItemId(12L).quantity(1).build()
                ))
                .build());
        assertEquals(400000.0, step1.getAmount());
        assertEquals(OrderStatus.PARTIALLY_REFUNDED, completedOrder.getStatus());
        verify(loyaltyService).applyForRefund(completedOrder, 440000.0, 0.0, 400000.0, true);

        // Step 2: refund remaining 40k by amount without re-restoring already-returned inventory
        Refund prior = Refund.builder()
                .id(960L)
                .amount(400000.0)
                .items(List.of(
                        RefundItem.builder().orderItemId(11L).productId(1L).quantity(2).build(),
                        RefundItem.builder().orderItemId(12L).productId(2L).quantity(1).build()
                ))
                .build();
        when(refundRepository.findByOrderId(500L)).thenReturn(List.of(prior));

        RefundDTO step2 = refundService.createRefund(RefundDTO.builder()
                .orderId(500L)
                .amount(40000.0)
                .reason("Waive restocking fee")
                .build());
        assertEquals(40000.0, step2.getAmount());
        assertEquals(OrderStatus.REFUNDED, completedOrder.getStatus());
        verify(inventoryCoordinator, times(1)).restoreByProduct(anyMap(), anyLong(), anyLong());
    }

    @Test
    void deleteRefund_allItemsReturnedWithFee_partiallyRefundedOrder_reversesFullLoyalty() throws Exception {
        completedOrder.setStatus(OrderStatus.PARTIALLY_REFUNDED);
        Refund refundToDelete = Refund.builder()
                .id(970L)
                .order(completedOrder)
                .branch(branch)
                .amount(400000.0)
                .items(List.of(
                        RefundItem.builder().orderItemId(11L).productId(1L).quantity(2).build(),
                        RefundItem.builder().orderItemId(12L).productId(2L).quantity(1).build()
                ))
                .build();

        when(refundRepository.findById(970L)).thenReturn(Optional.of(refundToDelete));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(refundRepository.findByOrderId(500L)).thenReturn(List.of(refundToDelete));

        refundService.deleteRefund(970L);

        assertEquals(OrderStatus.COMPLETED, completedOrder.getStatus());
        verify(loyaltyService).reverseForDeletedRefund(completedOrder, 440000.0, 0.0, 400000.0, true, true);
    }

    @Test
    void getRefundsByOrderId_returnsMappedRefundsAfterBranchAccessCheck() throws Exception {
        Refund r = Refund.builder()
                .id(980L)
                .order(completedOrder)
                .branch(branch)
                .amount(110000.0)
                .reason("Damaged")
                .build();
        when(orderRepository.findById(500L)).thenReturn(Optional.of(completedOrder));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(refundRepository.findByOrderId(500L)).thenReturn(List.of(r));

        List<RefundDTO> result = refundService.getRefundsByOrderId(500L);

        assertEquals(1, result.size());
        assertEquals(980L, result.get(0).getId());
        verify(accessControl).assertCanAccessBranch(cashier, branch);
    }

    @Test
    void createRefund_itemizedPartialRefund_restoresReturnedStockAndMarksPartiallyRefunded() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.findByOrderId(500L)).thenReturn(Collections.emptyList());
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> {
            Refund r = inv.getArgument(0);
            r.setId(901L);
            return r;
        });

        // Return 1 T-Shirt (raw 100k * 1.1 netOrderFactor = 110k)
        RefundDTO req = RefundDTO.builder()
                .orderId(500L)
                .reason("Wrong size")
                .items(List.of(RefundItemDTO.builder().orderItemId(11L).quantity(1).build()))
                .build();

        RefundDTO result = refundService.createRefund(req);

        assertEquals(901L, result.getId());
        assertEquals(110000.0, result.getAmount());
        assertEquals(OrderStatus.PARTIALLY_REFUNDED, completedOrder.getStatus());
        verify(inventoryCoordinator).restoreByProduct(argThat(m -> m.get(1L) == 1 && !m.containsKey(2L)), eq(10L), eq(500L));
        verify(loyaltyService).applyForRefund(completedOrder, 440000.0, 0.0, 110000.0, false);
    }

    @Test
    void createRefund_itemizedExceedingRemainingQuantity_throwsIllegalArgument() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.findByOrderId(500L)).thenReturn(Collections.emptyList());

        RefundDTO req = RefundDTO.builder()
                .orderId(500L)
                .items(List.of(RefundItemDTO.builder().orderItemId(11L).quantity(3).build()))
                .build();

        assertThrows(IllegalArgumentException.class, () -> refundService.createRefund(req));
        verify(inventoryCoordinator, never()).restoreByProduct(anyMap(), anyLong(), anyLong());
    }

    @Test
    void createRefund_partialItemsWithExcessiveManualAmount_throwsIllegalArgument() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.findByOrderId(500L)).thenReturn(Collections.emptyList());

        // Returning 1 T-Shirt (worth 110,000) but requesting 300,000
        RefundDTO req = RefundDTO.builder()
                .orderId(500L)
                .amount(300000.0)
                .items(List.of(RefundItemDTO.builder().orderItemId(11L).quantity(1).build()))
                .build();

        assertThrows(IllegalArgumentException.class, () -> refundService.createRefund(req));
    }

    @Test
    void createRefund_amountBasedPartialRefund_doesNotRestoreInventory() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.findByOrderId(500L)).thenReturn(Collections.emptyList());
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundDTO req = RefundDTO.builder()
                .orderId(500L)
                .amount(50000.0)
                .reason("Goodwill partial discount")
                .build();

        RefundDTO result = refundService.createRefund(req);

        assertEquals(50000.0, result.getAmount());
        assertEquals(OrderStatus.PARTIALLY_REFUNDED, completedOrder.getStatus());
        verify(inventoryCoordinator, never()).restoreByProduct(anyMap(), anyLong(), anyLong());
    }

    @Test
    void createRefund_amountBasedFullRefundAfterPriorPartial_restoresOnlyRemainingItems() throws Exception {
        Refund prior = Refund.builder()
                .id(800L)
                .amount(110000.0)
                .items(List.of(RefundItem.builder().orderItemId(11L).productId(1L).quantity(1).build()))
                .build();

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(orderRepository.findByIdWithLock(500L)).thenReturn(Optional.of(completedOrder));
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(activeShift));
        when(refundRepository.findByOrderId(500L)).thenReturn(List.of(prior));
        when(refundRepository.save(any(Refund.class))).thenAnswer(inv -> inv.getArgument(0));

        // Remaining refundable = 330,000 (full order) -> should restore 1 T-Shirt + 1 Jeans
        RefundDTO req = RefundDTO.builder().orderId(500L).build();
        RefundDTO result = refundService.createRefund(req);

        assertEquals(330000.0, result.getAmount());
        assertEquals(OrderStatus.REFUNDED, completedOrder.getStatus());
        verify(inventoryCoordinator).restoreByProduct(
                argThat(m -> m.get(1L) == 1 && m.get(2L) == 1), eq(10L), eq(500L));
        verify(loyaltyService).applyForRefund(completedOrder, 440000.0, 110000.0, 440000.0, true);
    }

    @Test
    void deleteRefund_itemizedFullRefund_reopensOrderAndReDeductsInventoryAndReversesLoyalty() throws Exception {
        completedOrder.setStatus(OrderStatus.REFUNDED);
        Refund refundToDelete = Refund.builder()
                .id(905L)
                .order(completedOrder)
                .branch(branch)
                .amount(330000.0)
                .items(List.of(
                        RefundItem.builder().productId(1L).quantity(1).build(),
                        RefundItem.builder().productId(2L).quantity(1).build()
                ))
                .build();
        Refund otherRefund = Refund.builder()
                .id(800L)
                .amount(110000.0)
                .items(List.of(RefundItem.builder().productId(1L).quantity(1).build()))
                .build();

        when(refundRepository.findById(905L)).thenReturn(Optional.of(refundToDelete));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(refundRepository.findByOrderId(500L)).thenReturn(List.of(otherRefund, refundToDelete));

        refundService.deleteRefund(905L);

        verify(inventoryCoordinator).deductByProduct(argThat(m -> m.get(1L) == 1 && m.get(2L) == 1), eq(10L));
        assertEquals(OrderStatus.PARTIALLY_REFUNDED, completedOrder.getStatus());
        verify(loyaltyService).reverseForDeletedRefund(completedOrder, 440000.0, 110000.0, 330000.0, true, true);
        verify(refundRepository).delete(refundToDelete);
    }

    @Test
    void createRefund_nonCashier_throwsAccessDenied() throws Exception {
        User manager = new User();
        manager.setId(55L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        manager.setBranch(branch);

        when(userService.getCurrentUser()).thenReturn(manager);

        RefundDTO req = RefundDTO.builder().orderId(500L).amount(50000.0).reason("Override").build();
        assertThrows(AccessDeniedException.class, () -> refundService.createRefund(req));
        verify(inventoryCoordinator, never()).restoreByProduct(anyMap(), anyLong(), anyLong());
        verify(refundRepository, never()).save(any());
    }
}
