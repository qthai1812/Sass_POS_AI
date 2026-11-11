package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Customer;
import com.zosh.modal.Order;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.UserService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerServiceImplTest {

    @Mock private CustomerRepository customerRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserService userService;

    @InjectMocks
    private CustomerServiceImpl customerService;

    private Store store;
    private User owner;
    private User manager;
    private User cashier;
    private User superAdmin;
    private Customer customer;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Fashion Co");

        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(store);

        manager = new User();
        manager.setId(20L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);
        manager.setStore(store);

        cashier = new User();
        cashier.setId(30L);
        cashier.setRole(UserRole.ROLE_CASHIER);
        cashier.setStore(store);

        superAdmin = new User();
        superAdmin.setId(1L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);

        customer = new Customer();
        customer.setId(100L);
        customer.setFullName("Nguyen Van A");
        customer.setPhone("0901234567");
        customer.setLoyaltyPoints(50);
        customer.setStore(store);
    }

    @Test
    void createCustomer_byCashier_forcesZeroLoyaltyPoints() throws Exception {
        Customer req = new Customer();
        req.setFullName("Khach Moi");
        req.setPhone(" 0987654321 ");
        req.setLoyaltyPoints(999);

        when(userService.getCurrentUser()).thenReturn(cashier);
        when(customerRepository.existsByStoreIdAndPhone(1L, "0987654321")).thenReturn(false);
        when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> {
            Customer c = inv.getArgument(0);
            c.setId(200L);
            return c;
        });

        Customer saved = customerService.createCustomer(req);

        assertEquals(0, saved.getLoyaltyPoints());
        assertEquals("0987654321", saved.getPhone());
        assertEquals(store, saved.getStore());
    }

    @Test
    void createCustomer_bySuperAdmin_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(superAdmin);

        assertThrows(AccessDeniedException.class, () -> customerService.createCustomer(new Customer()));
        verify(customerRepository, never()).save(any());
    }

    @Test
    void updateCustomer_byCashier_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);

        assertThrows(AccessDeniedException.class, () -> customerService.updateCustomer(100L, new Customer()));
        verify(customerRepository, never()).save(any());
    }

    @Test
    void updateCustomer_byBranchManager_updatesSuccessfully() throws Exception {
        Customer patch = new Customer();
        patch.setFullName("Nguyen Van B");
        patch.setLoyaltyPoints(120);

        when(userService.getCurrentUser()).thenReturn(manager);
        when(customerRepository.findByIdWithLock(100L)).thenReturn(Optional.of(customer));
        when(customerRepository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        Customer updated = customerService.updateCustomer(100L, patch);

        assertEquals("Nguyen Van B", updated.getFullName());
        assertEquals(120, updated.getLoyaltyPoints());
    }

    @Test
    void deleteCustomer_byCashierOrBranchManager_throwsAccessDenied() throws Exception {
        when(userService.getCurrentUser()).thenReturn(cashier);
        assertThrows(AccessDeniedException.class, () -> customerService.deleteCustomer(100L));

        when(userService.getCurrentUser()).thenReturn(manager);
        assertThrows(AccessDeniedException.class, () -> customerService.deleteCustomer(100L));

        verify(customerRepository, never()).delete(any());
    }

    @Test
    void deleteCustomer_withExistingOrders_throwsIllegalState() throws Exception {
        Order pastOrder = Order.builder().id(555L).status(OrderStatus.COMPLETED).build();
        when(userService.getCurrentUser()).thenReturn(owner);
        when(customerRepository.findById(100L)).thenReturn(Optional.of(customer));
        when(orderRepository.findByCustomerId(100L)).thenReturn(List.of(pastOrder));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> customerService.deleteCustomer(100L));
        assertTrue(ex.getMessage().contains("1"));
        verify(customerRepository, never()).delete(any());
    }

    @Test
    void deleteCustomer_byOwnerWithZeroOrders_deletesSuccessfully() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(customerRepository.findById(100L)).thenReturn(Optional.of(customer));
        when(orderRepository.findByCustomerId(100L)).thenReturn(Collections.emptyList());

        customerService.deleteCustomer(100L);

        verify(customerRepository).delete(customer);
    }
}
