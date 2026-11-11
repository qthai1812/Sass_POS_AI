package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.modal.Customer;
import com.zosh.modal.Order;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.CustomerService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;
    private final StoreRepository storeRepository;
    private final UserService userService;

    private Store resolveCurrentStore() {
        try {
            User user = userService.getCurrentUser();
            if (user == null || user.getRole() == UserRole.ROLE_SUPER_ADMIN) {
                return null;
            }
            if (user.getStore() != null) {
                return user.getStore();
            }
            if (user.getBranch() != null && user.getBranch().getStore() != null) {
                return user.getBranch().getStore();
            }
            return storeRepository.findByStoreAdminId(user.getId());
        } catch (Exception e) {
            return null;
        }
    }

    private void assertCustomerBelongsToCurrentStore(Customer customer) throws Exception {
        User user = userService.getCurrentUser();
        if (user == null || user.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin does not access store customers");
        }
        Store currentStore = resolveCurrentStore();
        if (currentStore == null) {
            throw new AccessDeniedException("You do not belong to any active store");
        }
        if (customer.getStore() == null || !customer.getStore().getId().equals(currentStore.getId())) {
            throw new AccessDeniedException("You do not have permission to access this customer");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Customer createCustomer(Customer customer) {
        customer.setId(null);
        User currentUser = null;
        try {
            currentUser = userService.getCurrentUser();
        } catch (Exception ignored) {
        }
        if (currentUser != null && currentUser.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin does not manage store customers");
        }
        if (customer.getCreatedAt() == null) {
            customer.setCreatedAt(LocalDateTime.now());
        }
        if (customer.getLoyaltyPoints() == null || customer.getLoyaltyPoints() < 0
                || (currentUser != null && currentUser.getRole() == UserRole.ROLE_CASHIER)) {
            customer.setLoyaltyPoints(0);
        }
        Store resolvedStore = resolveCurrentStore();
        if (resolvedStore != null) {
            customer.setStore(resolvedStore);
        }
        if (customer.getPhone() != null && !customer.getPhone().trim().isEmpty()) {
            String normalizedPhone = customer.getPhone().trim();
            customer.setPhone(normalizedPhone);
            if (customer.getStore() != null
                    && customerRepository.existsByStoreIdAndPhone(customer.getStore().getId(), normalizedPhone)) {
                throw new IllegalArgumentException("Số điện thoại khách hàng đã tồn tại trong cửa hàng này: " + normalizedPhone);
            }
        }
        if (customer.getStore() == null) {
            throw new IllegalArgumentException("Không xác định được cửa hàng để tạo khách hàng");
        }
        customer.setUpdatedAt(LocalDateTime.now());
        return customerRepository.save(customer);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Customer updateCustomer(Long id, Customer customer) throws Exception {
        User current = userService.getCurrentUser();
        if (current == null
                || (current.getRole() != UserRole.ROLE_STORE_OWNER && current.getRole() != UserRole.ROLE_BRANCH_MANAGER)) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng hoặc Quản lý chi nhánh mới có quyền cập nhật khách hàng");
        }
        Customer customerToUpdate = customerRepository.findByIdWithLock(id).orElseThrow(
                () -> new Exception("Customer not found")
        );
        assertCustomerBelongsToCurrentStore(customerToUpdate);
        if (customerToUpdate.getStore() == null) {
            customerToUpdate.setStore(resolveCurrentStore());
        }
        if (customer.getFullName() != null && !customer.getFullName().trim().isEmpty()) {
            customerToUpdate.setFullName(customer.getFullName().trim());
        }
        if (customer.getEmail() != null) {
            customerToUpdate.setEmail(customer.getEmail().trim());
        }
        if (customer.getPhone() != null && !customer.getPhone().trim().isEmpty()) {
            String normalizedPhone = customer.getPhone().trim();
            if (customerToUpdate.getStore() != null
                    && customerRepository.existsByStoreIdAndPhoneAndIdNot(
                            customerToUpdate.getStore().getId(), normalizedPhone, customerToUpdate.getId())) {
                throw new IllegalArgumentException("Số điện thoại này đã thuộc về một khách hàng khác trong cửa hàng");
            }
            customerToUpdate.setPhone(normalizedPhone);
        }
        if (customer.getLoyaltyPoints() != null) {
            int requestedPoints = Math.max(0, customer.getLoyaltyPoints());
            int existingPoints = customerToUpdate.getLoyaltyPoints() != null ? customerToUpdate.getLoyaltyPoints() : 0;
            if (requestedPoints != existingPoints) {
                customerToUpdate.setLoyaltyPoints(requestedPoints);
            }
        }
        customerToUpdate.setUpdatedAt(LocalDateTime.now());
        return customerRepository.save(customerToUpdate);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteCustomer(Long id) throws Exception {
        User current = userService.getCurrentUser();
        if (current == null || current.getRole() != UserRole.ROLE_STORE_OWNER) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng (Store Owner) mới có quyền xóa khách hàng");
        }
        Customer customerToDelete = customerRepository.findById(id).orElseThrow(
                () -> new Exception("Customer not found")
        );
        assertCustomerBelongsToCurrentStore(customerToDelete);
        List<Order> customerOrders = orderRepository.findByCustomerId(id);
        if (!customerOrders.isEmpty()) {
            throw new IllegalStateException(
                    "Không thể xóa khách hàng đã phát sinh " + customerOrders.size() + " đơn hàng trong lịch sử"
            );
        }
        customerRepository.delete(customerToDelete);
    }

    @Override
    @Transactional(readOnly = true)
    public Customer getCustomer(Long id) throws Exception {
        Customer customer = customerRepository.findById(id).orElseThrow(
                () -> new Exception("Customer not found")
        );
        assertCustomerBelongsToCurrentStore(customer);
        return customer;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Customer> getAllCustomers() throws Exception {
        User current = userService.getCurrentUser();
        if (current != null && current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin does not manage store customers");
        }
        Store currentStore = resolveCurrentStore();
        if (currentStore != null) {
            return customerRepository.findByStoreId(currentStore.getId());
        }
        return Collections.emptyList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Customer> searchCustomers(String keyword) throws Exception {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getAllCustomers();
        }
        User current = userService.getCurrentUser();
        if (current != null && current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin does not manage store customers");
        }
        Store currentStore = resolveCurrentStore();
        if (currentStore != null) {
            return customerRepository.searchCustomersByStore(currentStore.getId(), keyword.trim());
        }
        return Collections.emptyList();
    }
}
