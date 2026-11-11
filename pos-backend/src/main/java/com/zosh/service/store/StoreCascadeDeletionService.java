package com.zosh.service.store;

import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Xử lý xóa dây chuyền (cascade cleanup) toàn bộ dữ liệu liên kết khi xóa một Store
 * nhằm đảm bảo không phát sinh lỗi khóa ngoại (foreign key constraint) và vô hiệu hóa nhân sự mồ côi.
 */
@Component
@RequiredArgsConstructor
public class StoreCascadeDeletionService {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CouponRepository couponRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final RefundRepository refundRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final CustomerRepository customerRepository;
    private final PaymentSessionRepository paymentSessionRepository;
    private final BranchTransferRequestRepository branchTransferRequestRepository;

    @Transactional(rollbackFor = Exception.class)
    public void deleteStoreCascade(Store store) {
        Long storeId = store.getId();
        Long ownerId = store.getStoreAdmin() != null ? store.getStoreAdmin().getId() : null;

        branchTransferRequestRepository.deleteByStoreId(storeId);
        unlinkStoreUsersAndAdmin(store, ownerId);
        deleteBranchesAndDependentData(storeId, ownerId);
        deleteProductsAndCategories(storeId);
        deleteStoreCommercialData(storeId);

        paymentSessionRepository.deleteByStoreId(storeId);
        storeRepository.delete(store);
    }

    private void unlinkStoreUsersAndAdmin(Store store, Long ownerId) {
        List<User> storeUsers = userRepository.findByStore(store);
        for (User u : storeUsers) {
            u.setStore(null);
            u.setBranch(null);
            deactivateOrphanedEmployeeIfApplicable(u, ownerId);
            userRepository.save(u);
        }
        if (store.getStoreAdmin() != null) {
            User admin = store.getStoreAdmin();
            admin.setStore(null);
            admin.setBranch(null);
            userRepository.save(admin);
            store.setStoreAdmin(null);
            storeRepository.save(store);
        }
    }

    private void deleteBranchesAndDependentData(Long storeId, Long ownerId) {
        List<Branch> branches = branchRepository.findByStoreId(storeId);
        for (Branch branch : branches) {
            Long branchId = branch.getId();

            List<User> branchUsers = userRepository.findByBranchId(branchId);
            for (User bu : branchUsers) {
                bu.setBranch(null);
                bu.setStore(null);
                deactivateOrphanedEmployeeIfApplicable(bu, ownerId);
                userRepository.save(bu);
            }
            branch.setManager(null);
            branchRepository.save(branch);

            List<Refund> branchRefunds = refundRepository.findByBranchId(branchId);
            if (!branchRefunds.isEmpty()) {
                refundRepository.deleteAll(branchRefunds);
            }

            List<ShiftReport> branchShifts = shiftReportRepository.findByBranchId(branchId);
            for (ShiftReport sr : branchShifts) {
                List<Refund> srRefunds = refundRepository.findByShiftReportId(sr.getId());
                if (!srRefunds.isEmpty()) {
                    refundRepository.deleteAll(srRefunds);
                }
            }
            if (!branchShifts.isEmpty()) {
                shiftReportRepository.deleteAll(branchShifts);
            }

            List<Order> branchOrders = orderRepository.findByBranchId(branchId);
            for (Order order : branchOrders) {
                List<Refund> orderRefunds = refundRepository.findByOrderId(order.getId());
                if (!orderRefunds.isEmpty()) {
                    refundRepository.deleteAll(orderRefunds);
                }
            }
            if (!branchOrders.isEmpty()) {
                orderRepository.deleteAll(branchOrders);
            }

            List<Inventory> branchInventories = inventoryRepository.findByBranchId(branchId);
            if (!branchInventories.isEmpty()) {
                inventoryRepository.deleteAll(branchInventories);
            }

            branchRepository.delete(branch);
        }
    }

    private void deleteProductsAndCategories(Long storeId) {
        List<Product> products = productRepository.findByStoreId(storeId);
        for (Product product : products) {
            List<Inventory> prodInv = inventoryRepository.findByProductId(product.getId());
            if (!prodInv.isEmpty()) {
                inventoryRepository.deleteAll(prodInv);
            }
            List<OrderItem> orderItems = orderItemRepository.findByProductId(product.getId());
            for (OrderItem item : orderItems) {
                item.setProduct(null);
                orderItemRepository.save(item);
            }
            productRepository.delete(product);
        }

        List<Category> categories = categoryRepository.findByStoreId(storeId);
        if (!categories.isEmpty()) {
            categoryRepository.deleteAll(categories);
        }
    }

    private void deleteStoreCommercialData(Long storeId) {
        List<Coupon> coupons = couponRepository.findByStoreId(storeId);
        if (!coupons.isEmpty()) {
            couponRepository.deleteAll(coupons);
        }

        List<Subscription> subscriptions = subscriptionRepository.findByStoreId(storeId);
        if (!subscriptions.isEmpty()) {
            subscriptionRepository.deleteAll(subscriptions);
        }

        List<Customer> storeCustomers = customerRepository.findByStoreId(storeId);
        for (Customer c : storeCustomers) {
            if (c.getStore() != null && c.getStore().getId().equals(storeId)) {
                List<Order> custOrders = orderRepository.findByCustomerId(c.getId());
                for (Order o : custOrders) {
                    o.setCustomer(null);
                    orderRepository.save(o);
                }
                customerRepository.delete(c);
            }
        }
    }

    private void deactivateOrphanedEmployeeIfApplicable(User u, Long ownerId) {
        if (u == null || u.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            return;
        }
        boolean isOwner = ownerId != null && ownerId.equals(u.getId());
        if (!isOwner && u.getRole() != UserRole.ROLE_STORE_OWNER) {
            u.setLoginAccess(false);
        }
    }
}
