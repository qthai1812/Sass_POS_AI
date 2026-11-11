package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.payload.dto.OrderItemDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PaymentGatewayService.PaymentSessionDTO;
import com.zosh.service.UserService;
import com.zosh.service.order.CustomerLoyaltyService;
import com.zosh.service.order.OrderInventoryCoordinator;
import com.zosh.service.order.OrderPricingCalculator;
import com.zosh.service.order.OrderPricingCalculator.DiscountResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
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
class OrderServiceImplTest {

    @Mock private UserService userService;
    @Mock private ProductRepository productRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private AccessControlService accessControl;
    @Mock private PaymentGatewayService paymentGatewayService;
    @Mock private OrderPricingCalculator pricingCalculator;
    @Mock private OrderInventoryCoordinator inventoryCoordinator;
    @Mock private CustomerLoyaltyService loyaltyService;

    @InjectMocks
    private OrderServiceImpl orderService;

    private Store store;
    private Branch branch;
    private User cashier;
    private User manager;
    private User owner;
    private Product productA;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setStatus(StoreStatus.ACTIVE);
        store.setTaxRate(10.0);
        branch = Branch.builder().id(10L).store(store).build();
        cashier = new User();
        cashier.setId(100L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setBranch(branch);
        cashier.setStore(store);
        manager = new User();
        manager.setId(101L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        manager.setBranch(branch);
        manager.setStore(store);
        owner = new User();
        owner.setId(102L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(store);
        productA = Product.builder().id(5L).name("Shirt").sellingPrice(100000.0).store(store).build();
    }

    @Test
    void createOrder_nonCashier_throwsAccessDenied() throws Exception {
        OrderDTO dto = OrderDTO.builder()
                .items(List.of(OrderItemDTO.builder().productId(5L).quantity(1).build()))
                .build();

        when(userService.getCurrentUser()).thenReturn(owner);
        assertThrows(AccessDeniedException.class, () -> orderService.createOrder(dto));

        when(userService.getCurrentUser()).thenReturn(manager);
        assertThrows(AccessDeniedException.class, () -> orderService.createOrder(dto));
        verify(orderRepository, never()).save(any());
    }

    @Test
    void createOrder_cashierWithoutActiveShift_throwsException() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.empty());

        OrderDTO dto = OrderDTO.builder()
                .items(List.of(OrderItemDTO.builder().productId(5L).quantity(1).build()))
                .build();

        Exception ex = assertThrows(Exception.class, () -> orderService.createOrder(dto));
        assertTrue(ex.getMessage().contains("Start Shift"));
    }

    @Test
    void createOrder_blockedStore_throwsException() throws Exception {
        store.setStatus(StoreStatus.BLOCKED);
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(ShiftReport.builder().id(1L).build()));

        OrderDTO dto = OrderDTO.builder()
                .items(List.of(OrderItemDTO.builder().productId(5L).quantity(1).build()))
                .build();

        Exception ex = assertThrows(Exception.class, () -> orderService.createOrder(dto));
        assertTrue(ex.getMessage().contains("blocked"));
    }

    @Test
    void createOrder_cashWithDuplicateProductItems_mergesQtyAndSavesOrder() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(ShiftReport.builder().id(1L).build()));
        when(productRepository.findAllById(List.of(5L))).thenReturn(List.of(productA));

        when(pricingCalculator.subTotal(anyList())).thenReturn(300000.0);
        when(pricingCalculator.computeDiscount(any(), eq(300000.0), isNull(), eq(branch), eq(cashier)))
                .thenReturn(new DiscountResult(0.0, null, 0));
        when(pricingCalculator.computeTax(300000.0, store)).thenReturn(30000.0);

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(999L);
            return o;
        });

        OrderDTO dto = OrderDTO.builder()
                .paymentType(PaymentType.CASH)
                .items(List.of(
                        OrderItemDTO.builder().productId(5L).quantity(1).build(),
                        OrderItemDTO.builder().productId(5L).quantity(2).build()
                ))
                .build();

        OrderDTO result = orderService.createOrder(dto);

        assertEquals(999L, result.getId());
        assertEquals(300000.0, result.getSubTotal());
        assertEquals(30000.0, result.getTaxAmount());
        assertEquals(330000.0, result.getTotalAmount());
        assertEquals(OrderStatus.COMPLETED, result.getStatus());
        // Merged items -> size 1 with qty 3
        assertEquals(1, result.getItems().size());
        assertEquals(3, result.getItems().get(0).getQuantity());
        verify(inventoryCoordinator).deductForItems(argThat(list ->
                list.size() == 1 && list.get(0).getQuantity() == 3), eq(10L));
    }

    @Test
    void createOrder_completedCardWithoutSessionId_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(ShiftReport.builder().id(1L).build()));
        when(productRepository.findAllById(List.of(5L))).thenReturn(List.of(productA));
        when(pricingCalculator.subTotal(anyList())).thenReturn(100000.0);
        when(pricingCalculator.computeDiscount(any(), anyDouble(), any(), any(), any()))
                .thenReturn(new DiscountResult(0.0, null, 0));
        when(pricingCalculator.computeTax(anyDouble(), any())).thenReturn(10000.0);

        OrderDTO dto = OrderDTO.builder()
                .paymentType(PaymentType.CARD)
                .status(OrderStatus.COMPLETED)
                .items(List.of(OrderItemDTO.builder().productId(5L).quantity(1).build()))
                .build();

        assertThrows(AccessDeniedException.class, () -> orderService.createOrder(dto));
        verify(inventoryCoordinator, never()).deductForItems(anyList(), anyLong());
    }

    @Test
    void createOrder_completedUpiWithSession_consumesPaymentAfterInventoryDeduction() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(shiftReportRepository.findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(cashier))
                .thenReturn(Optional.of(ShiftReport.builder().id(1L).build()));
        when(productRepository.findAllById(List.of(5L))).thenReturn(List.of(productA));
        when(pricingCalculator.subTotal(anyList())).thenReturn(100000.0);
        when(pricingCalculator.computeDiscount(any(), anyDouble(), any(), any(), any()))
                .thenReturn(new DiscountResult(0.0, null, 0));
        when(pricingCalculator.computeTax(anyDouble(), any())).thenReturn(10000.0);

        PaymentSessionDTO session = PaymentSessionDTO.builder()
                .sessionId("sess-123")
                .transactionId("tx-999")
                .status("SUCCESS")
                .build();
        when(paymentGatewayService.verifyAndConsumePosOrderPayment("sess-123", 1L, 110000.0, null))
                .thenReturn(session);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(555L);
            return o;
        });
        when(orderRepository.findById(555L)).thenAnswer(inv -> Optional.of(
                Order.builder().id(555L).paymentSessionId("sess-123").paymentTransactionId("tx-999")
                        .status(OrderStatus.COMPLETED).totalAmount(110000.0).build()
        ));

        OrderDTO dto = OrderDTO.builder()
                .paymentType(PaymentType.UPI)
                .paymentSessionId("sess-123")
                .items(List.of(OrderItemDTO.builder().productId(5L).quantity(1).build()))
                .build();

        OrderDTO result = orderService.createOrder(dto);

        assertEquals("tx-999", result.getPaymentTransactionId());
        InOrder inOrder = inOrder(inventoryCoordinator, paymentGatewayService);
        inOrder.verify(inventoryCoordinator).deductForItems(anyList(), eq(10L));
        inOrder.verify(paymentGatewayService).verifyAndConsumePosOrderPayment("sess-123", 1L, 110000.0, null);
        inOrder.verify(paymentGatewayService).linkOrderToSession("sess-123", 555L);
    }

    @Test
    void updateOrderStatus_pendingToCompleted_verifiesGatewayAndAwardsLoyalty() throws Exception {
        Order pendingOrder = Order.builder()
                .id(50L)
                .branch(branch)
                .status(OrderStatus.PENDING)
                .paymentType(PaymentType.UPI)
                .paymentSessionId("sess-abc")
                .totalAmount(200000.0)
                .build();

        when(orderRepository.findByIdWithLock(50L)).thenReturn(Optional.of(pendingOrder));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(paymentGatewayService.verifyAndConsumePosOrderPayment("sess-abc", 1L, 200000.0, 50L))
                .thenReturn(PaymentSessionDTO.builder().sessionId("sess-abc").transactionId("tx-1").build());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderDTO result = orderService.updateOrderStatus(50L, OrderStatus.COMPLETED);

        assertEquals(OrderStatus.COMPLETED, result.getStatus());
        assertNotNull(result.getPaidAt());
        verify(loyaltyService).awardOnCompletion(pendingOrder, 200000.0);
    }

    @Test
    void updateOrderStatus_completedToCancelled_byManager_restoresInventoryAndRevertsLoyalty() throws Exception {
        Order completed = Order.builder()
                .id(51L)
                .branch(branch)
                .status(OrderStatus.COMPLETED)
                .totalAmount(100000.0)
                .build();

        when(orderRepository.findByIdWithLock(51L)).thenReturn(Optional.of(completed));
        when(userService.getCurrentUser()).thenReturn(manager);
        when(refundRepository.findByOrderId(51L)).thenReturn(Collections.emptyList());
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderDTO result = orderService.updateOrderStatus(51L, OrderStatus.CANCELLED);

        assertEquals(OrderStatus.CANCELLED, result.getStatus());
        verify(accessControl).assertCanManageBranch(manager, branch);
        verify(inventoryCoordinator).restoreRemainingForOrder(completed, Collections.emptyList());
        verify(loyaltyService).revertRemaining(completed, Collections.emptyList());
    }

    @Test
    void updateOrderStatus_completedToCancelled_byCashier_throwsAccessDenied() throws Exception {
        Order completed = Order.builder()
                .id(53L)
                .branch(branch)
                .status(OrderStatus.COMPLETED)
                .totalAmount(100000.0)
                .build();

        when(orderRepository.findByIdWithLock(53L)).thenReturn(Optional.of(completed));
        when(userService.getCurrentUser()).thenReturn(cashier);

        assertThrows(AccessDeniedException.class,
                () -> orderService.updateOrderStatus(53L, OrderStatus.CANCELLED));
        verify(orderRepository, never()).save(any());
    }

    @Test
    void updateOrderStatus_refundedOrder_throwsIllegalState() throws Exception {
        Order refunded = Order.builder().id(52L).branch(branch).status(OrderStatus.REFUNDED).build();
        when(orderRepository.findByIdWithLock(52L)).thenReturn(Optional.of(refunded));
        when(userService.getCurrentUser()).thenReturn(manager);

        assertThrows(IllegalStateException.class,
                () -> orderService.updateOrderStatus(52L, OrderStatus.CANCELLED));
    }

    @Test
    void cancelExpiredPendingOrders_linksSuccessfulSessionsAndCancelsUnpaid() {
        Order paidCandidate = Order.builder().id(1L).status(OrderStatus.PENDING).paymentSessionId("s-paid").build();
        Order unpaidCandidate = Order.builder().id(2L).status(OrderStatus.PENDING).paymentSessionId("s-unpaid").build();

        when(orderRepository.findByStatusAndCreatedAtBefore(eq(OrderStatus.PENDING), any()))
                .thenReturn(List.of(paidCandidate, unpaidCandidate));
        when(orderRepository.findByIdWithLock(1L)).thenReturn(Optional.of(paidCandidate));
        when(orderRepository.findByIdWithLock(2L)).thenReturn(Optional.of(unpaidCandidate));
        when(paymentGatewayService.getRawSession("s-paid"))
                .thenReturn(PaymentSessionDTO.builder().status("SUCCESS").build());
        when(paymentGatewayService.getRawSession("s-unpaid"))
                .thenReturn(PaymentSessionDTO.builder().status("PENDING").build());

        int count = orderService.cancelExpiredPendingOrders();

        assertEquals(1, count);
        verify(paymentGatewayService).linkOrderToSession("s-paid", 1L);
        verify(inventoryCoordinator).restoreRemainingForOrder(unpaidCandidate, Collections.emptyList());
        verify(loyaltyService).restoreUsedPoints(unpaidCandidate);
        assertEquals(OrderStatus.CANCELLED, unpaidCandidate.getStatus());
        verify(orderRepository).save(unpaidCandidate);
    }

    @Test
    void deleteOrder_completedOrder_revertsInventoryAndLoyaltyAndUnlinksRefunds() throws Exception {
        Order order = Order.builder().id(77L).branch(branch).status(OrderStatus.COMPLETED).build();
        Refund linkedRefund = Refund.builder().id(88L).order(order).build();

        when(orderRepository.findById(77L)).thenReturn(Optional.of(order));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(refundRepository.findByOrderId(77L)).thenReturn(List.of(linkedRefund));

        orderService.deleteOrder(77L);

        verify(inventoryCoordinator).restoreRemainingForOrder(eq(order), anyList());
        verify(loyaltyService).revertRemaining(eq(order), anyList());
        assertNull(linkedRefund.getOrder());
        verify(refundRepository).save(linkedRefund);
        verify(orderRepository).delete(order);
    }

    @Test
    void deleteOrder_alreadyRefunded_skipsDoubleReversion() throws Exception {
        Order order = Order.builder().id(78L).branch(branch).status(OrderStatus.REFUNDED).build();
        when(orderRepository.findById(78L)).thenReturn(Optional.of(order));
        when(userService.getCurrentUser()).thenReturn(cashier);
        when(refundRepository.findByOrderId(78L)).thenReturn(Collections.emptyList());

        orderService.deleteOrder(78L);

        verify(inventoryCoordinator, never()).restoreRemainingForOrder(any(), anyList());
        verify(loyaltyService, never()).revertRemaining(any(), anyList());
        verify(orderRepository).delete(order);
    }
}
