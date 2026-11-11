package com.zosh.service.store;

import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StoreCascadeDeletionServiceTest {

    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private ProductRepository productRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private CouponRepository couponRepository;
    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private RefundRepository refundRepository;
    @Mock private ShiftReportRepository shiftReportRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private PaymentSessionRepository paymentSessionRepository;
    @Mock private BranchTransferRequestRepository branchTransferRequestRepository;

    @InjectMocks
    private StoreCascadeDeletionService deletionService;

    @Test
    void deleteStoreCascade_unlinksStaffDisablesCashierAndDeletesEntitiesInOrder() {
        User owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setLoginAccess(true);

        User cashier = new User();
        cashier.setId(11L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setLoginAccess(true);

        Store store = new Store();
        store.setId(1L);
        store.setStoreAdmin(owner);
        owner.setStore(store);
        cashier.setStore(store);

        when(userRepository.findByStore(store)).thenReturn(List.of(owner, cashier));
        when(branchRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());
        when(productRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());
        when(categoryRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());
        when(couponRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());
        when(subscriptionRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());
        when(customerRepository.findByStoreId(1L)).thenReturn(Collections.emptyList());

        deletionService.deleteStoreCascade(store);

        assertTrue(owner.getLoginAccess());
        assertNull(owner.getStore());
        assertFalse(cashier.getLoginAccess());
        assertNull(cashier.getStore());
        assertNull(store.getStoreAdmin());

        InOrder inOrder = inOrder(branchTransferRequestRepository, paymentSessionRepository, storeRepository);
        inOrder.verify(branchTransferRequestRepository).deleteByStoreId(1L);
        inOrder.verify(paymentSessionRepository).deleteByStoreId(1L);
        inOrder.verify(storeRepository).delete(store);
    }

    @Test
    void deleteStoreCascade_cleansBranchesOrdersProductsAndCustomersWithoutReSavingCustomer() {
        Store store = new Store();
        store.setId(2L);
        Branch branch = Branch.builder().id(20L).store(store).build();
        Order order = Order.builder().id(200L).branch(branch).build();
        Product product = Product.builder().id(300L).store(store).build();
        OrderItem orderItem = OrderItem.builder().id(301L).product(product).build();
        Customer customer = Customer.builder().id(400L).store(store).fullName("Guest").build();

        when(userRepository.findByStore(store)).thenReturn(Collections.emptyList());
        when(branchRepository.findByStoreId(2L)).thenReturn(List.of(branch));
        when(userRepository.findByBranchId(20L)).thenReturn(Collections.emptyList());
        when(refundRepository.findByBranchId(20L)).thenReturn(Collections.emptyList());
        when(shiftReportRepository.findByBranchId(20L)).thenReturn(Collections.emptyList());
        when(orderRepository.findByBranchId(20L)).thenReturn(List.of(order));
        when(refundRepository.findByOrderId(200L)).thenReturn(Collections.emptyList());
        when(inventoryRepository.findByBranchId(20L)).thenReturn(Collections.emptyList());

        when(productRepository.findByStoreId(2L)).thenReturn(List.of(product));
        when(inventoryRepository.findByProductId(300L)).thenReturn(Collections.emptyList());
        when(orderItemRepository.findByProductId(300L)).thenReturn(List.of(orderItem));

        when(customerRepository.findByStoreId(2L)).thenReturn(List.of(customer));
        when(orderRepository.findByCustomerId(400L)).thenReturn(List.of(order));

        deletionService.deleteStoreCascade(store);

        assertNull(orderItem.getProduct());
        verify(orderItemRepository).save(orderItem);
        verify(productRepository).delete(product);

        assertNull(order.getCustomer());
        verify(orderRepository).save(order);
        verify(customerRepository).delete(customer);
        verify(customerRepository, never()).save(customer);

        verify(branchRepository).delete(branch);
        verify(storeRepository).delete(store);
    }

    @Test
    void deleteStoreCascade_cleansBranchRefundsShiftsAndCategories() {
        Store store = new Store();
        store.setId(3L);
        Branch branch = Branch.builder().id(30L).store(store).build();
        ShiftReport shift = ShiftReport.builder().id(31L).branch(branch).build();
        Refund branchRefund = Refund.builder().id(32L).build();
        Refund shiftRefund = Refund.builder().id(33L).shiftReport(shift).build();
        Inventory inv = Inventory.builder().id(34L).branch(branch).build();
        Category category = Category.builder().id(35L).store(store).build();
        Coupon coupon = Coupon.builder().id(36L).store(store).build();
        Subscription sub = Subscription.builder().id(37L).store(store).build();

        when(userRepository.findByStore(store)).thenReturn(Collections.emptyList());
        when(branchRepository.findByStoreId(3L)).thenReturn(List.of(branch));
        when(userRepository.findByBranchId(30L)).thenReturn(Collections.emptyList());
        when(refundRepository.findByBranchId(30L)).thenReturn(List.of(branchRefund));
        when(shiftReportRepository.findByBranchId(30L)).thenReturn(List.of(shift));
        when(refundRepository.findByShiftReportId(31L)).thenReturn(List.of(shiftRefund));
        when(orderRepository.findByBranchId(30L)).thenReturn(Collections.emptyList());
        when(inventoryRepository.findByBranchId(30L)).thenReturn(List.of(inv));
        when(productRepository.findByStoreId(3L)).thenReturn(Collections.emptyList());
        when(categoryRepository.findByStoreId(3L)).thenReturn(List.of(category));
        when(couponRepository.findByStoreId(3L)).thenReturn(List.of(coupon));
        when(subscriptionRepository.findByStoreId(3L)).thenReturn(List.of(sub));
        when(customerRepository.findByStoreId(3L)).thenReturn(Collections.emptyList());

        deletionService.deleteStoreCascade(store);

        verify(refundRepository).deleteAll(List.of(branchRefund));
        verify(refundRepository).deleteAll(List.of(shiftRefund));
        verify(shiftReportRepository).deleteAll(List.of(shift));
        verify(inventoryRepository).deleteAll(List.of(inv));
        verify(categoryRepository).deleteAll(List.of(category));
        verify(couponRepository).deleteAll(List.of(coupon));
        verify(subscriptionRepository).deleteAll(List.of(sub));
    }

    @Test
    void deleteStoreCascade_superAdminInBranchUsersRemainsLoginActive() {
        User superAdmin = new User();
        superAdmin.setId(99L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);
        superAdmin.setLoginAccess(true);

        Store store = new Store();
        store.setId(4L);
        Branch branch = Branch.builder().id(40L).store(store).build();

        when(userRepository.findByStore(store)).thenReturn(Collections.emptyList());
        when(branchRepository.findByStoreId(4L)).thenReturn(List.of(branch));
        when(userRepository.findByBranchId(40L)).thenReturn(List.of(superAdmin));

        deletionService.deleteStoreCascade(store);

        assertTrue(superAdmin.getLoginAccess());
        assertNull(superAdmin.getBranch());
        verify(userRepository).save(superAdmin);
    }
}
