package com.zosh.service.impl;

import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.StoreMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.repository.*;
import com.zosh.service.StoreService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StoreServiceImpl implements StoreService {

    private final StoreRepository storeRepository;
    private final UserService userService;
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

    private StoreDTO enrichStoreEarnings(StoreDTO dto, Double revenue) {
        if (dto == null) {
            return null;
        }
        double safeRevenue = revenue != null ? Math.max(0.0, revenue) : 0.0;
        double rate = dto.getCommissionRate() != null ? dto.getCommissionRate() : 2.5;
        double earnings = Math.round(safeRevenue * (rate / 100.0) * 100.0) / 100.0;
        dto.setTotalRevenue(safeRevenue);
        dto.setTotalEarnings(earnings);
        return dto;
    }

    private Store resolveStoreForUser(User user) {
        if (user == null) {
            return null;
        }
        Store store = storeRepository.findByStoreAdminId(user.getId());
        if (store == null && user.getStore() != null) {
            store = user.getStore();
        }
        if (store == null && user.getBranch() != null) {
            store = user.getBranch().getStore();
        }
        return store;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO createStore(StoreDTO storeDTO, User user) {
        Store existing = storeRepository.findByStoreAdminId(user.getId());
        if (existing != null) {
            Double revenue = orderRepository.sumCompletedSalesByStoreId(existing.getId());
            return enrichStoreEarnings(StoreMapper.toDTO(existing), revenue);
        }
        Store store = StoreMapper.toEntity(storeDTO, user);
        Store savedStore = storeRepository.save(store);

        // Liên kết ngược Store vào User để phân quyền đồng nhất ở mọi luồng
        user.setStore(savedStore);
        userRepository.save(user);

        return enrichStoreEarnings(StoreMapper.toDTO(savedStore), 0.0);
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreById(Long id) throws Exception {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        Store store = storeRepository.findById(id).orElseThrow(
                () -> new Exception("store not found...")
        );
        if (currentUser.getRole() != UserRole.ROLE_ADMIN) {
            Store userStore = resolveStoreForUser(currentUser);
            if (userStore == null || !userStore.getId().equals(store.getId())) {
                throw new AccessDeniedException("You do not have permission to access this store");
            }
        }
        Double revenue = orderRepository.sumCompletedSalesByStoreId(store.getId());
        return enrichStoreEarnings(StoreMapper.toDTO(store), revenue);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoreDTO> getAllStores(StoreStatus status) {
        User currentUser;
        try {
            currentUser = userService.getCurrentUser();
        } catch (UserException e) {
            return Collections.emptyList();
        }

        List<Store> stores;
        if (currentUser.getRole() == UserRole.ROLE_ADMIN) {
            stores = (status != null)
                    ? storeRepository.findByStatus(status)
                    : storeRepository.findAll();
        } else {
            Store ownStore = resolveStoreForUser(currentUser);
            if (ownStore == null || (status != null && ownStore.getStatus() != status)) {
                return Collections.emptyList();
            }
            stores = Collections.singletonList(ownStore);
        }

        Map<Long, Double> revenueByStore = new HashMap<>();
        for (Object[] row : orderRepository.sumCompletedSalesGroupedByStore()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number) {
                Long storeId = ((Number) row[0]).longValue();
                Double rev = row[1] instanceof Number ? ((Number) row[1]).doubleValue() : 0.0;
                revenueByStore.put(storeId, rev);
            }
        }
        // Trừ đi số tiền hoàn trả một phần (Partial Refund) trên các đơn COMPLETED để doanh thu & hoa hồng chính xác 100%
        for (Object[] row : refundRepository.sumRefundsOnCompletedOrdersGroupedByStore()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number) {
                Long storeId = ((Number) row[0]).longValue();
                Double refunded = row[1] instanceof Number ? ((Number) row[1]).doubleValue() : 0.0;
                revenueByStore.computeIfPresent(storeId, (k, gross) -> Math.max(0.0, gross - refunded));
            }
        }

        return stores.stream()
                .map(s -> enrichStoreEarnings(StoreMapper.toDTO(s), revenueByStore.getOrDefault(s.getId(), 0.0)))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Store getStoreByAdmin() throws UserException {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        Store store = storeRepository.findByStoreAdminId(currentUser.getId());
        if (store == null && currentUser.getStore() != null) {
            store = currentUser.getStore();
        }
        return store;
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreDtoByAdmin() throws UserException {
        Store store = getStoreByAdmin();
        if (store == null) {
            return null;
        }
        Double revenue = orderRepository.sumCompletedSalesByStoreId(store.getId());
        return enrichStoreEarnings(StoreMapper.toDTO(store), revenue);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO updateStore(Long id, StoreDTO storeDTO) throws Exception {
        User currentUser = userService.getCurrentUser();
        Store existing = null;

        if (currentUser.getRole() == UserRole.ROLE_ADMIN && id != null) {
            existing = storeRepository.findById(id).orElse(null);
        }
        if (existing == null) {
            existing = getStoreByAdmin();
        }
        if (existing == null && id != null) {
            Store candidate = storeRepository.findById(id).orElse(null);
            if (candidate != null && currentUser.getStore() != null
                    && candidate.getId().equals(currentUser.getStore().getId())
                    && (currentUser.getRole() == UserRole.ROLE_STORE_ADMIN
                    || currentUser.getRole() == UserRole.ROLE_STORE_MANAGER)) {
                existing = candidate;
            }
        }
        if (existing == null) {
            throw new Exception("store not found");
        }
        if (id != null && !existing.getId().equals(id) && currentUser.getRole() != UserRole.ROLE_ADMIN) {
            throw new AccessDeniedException("You do not have permission to update this store");
        }

        if (storeDTO.getBrand() != null) {
            existing.setBrand(storeDTO.getBrand());
        }
        if (storeDTO.getDescription() != null) {
            existing.setDescription(storeDTO.getDescription());
        }
        if (storeDTO.getStoreType() != null) {
            existing.setStoreType(storeDTO.getStoreType());
        }
        if (storeDTO.getCurrency() != null) {
            existing.setCurrency(storeDTO.getCurrency());
        }
        if (storeDTO.getTaxRate() != null && storeDTO.getTaxRate() >= 0) {
            existing.setTaxRate(storeDTO.getTaxRate());
        }
        if (storeDTO.getTimezone() != null) {
            existing.setTimezone(storeDTO.getTimezone());
        }
        if (storeDTO.getDateFormat() != null) {
            existing.setDateFormat(storeDTO.getDateFormat());
        }
        if (storeDTO.getReceiptFooter() != null) {
            existing.setReceiptFooter(storeDTO.getReceiptFooter());
        }
        if (storeDTO.getCommissionRate() != null && currentUser.getRole() == UserRole.ROLE_ADMIN) {
            existing.setCommissionRate(storeDTO.getCommissionRate());
        }
        if (storeDTO.getStatus() != null && currentUser.getRole() == UserRole.ROLE_ADMIN) {
            existing.setStatus(storeDTO.getStatus());
        }
        if (storeDTO.getContact() != null) {
            StoreContact currentContact = existing.getContact() != null ? existing.getContact() : new StoreContact();
            StoreContact contact = StoreContact.builder()
                    .address(storeDTO.getContact().getAddress() != null ? storeDTO.getContact().getAddress() : currentContact.getAddress())
                    .phone(storeDTO.getContact().getPhone() != null ? storeDTO.getContact().getPhone() : currentContact.getPhone())
                    .email(storeDTO.getContact().getEmail() != null ? storeDTO.getContact().getEmail() : currentContact.getEmail())
                    .build();
            existing.setContact(contact);
        }
        if (storeDTO.getPaymentInfo() != null) {
            StorePaymentInfo currentPay = existing.getPaymentInfo() != null ? existing.getPaymentInfo() : new StorePaymentInfo();
            StorePaymentInfo reqPay = storeDTO.getPaymentInfo();
            StorePaymentInfo updatedPay = StorePaymentInfo.builder()
                    .acceptCash(reqPay.getAcceptCash() != null ? reqPay.getAcceptCash() : currentPay.getAcceptCash())
                    .acceptMomo(reqPay.getAcceptMomo() != null ? reqPay.getAcceptMomo() : currentPay.getAcceptMomo())
                    .acceptCard(reqPay.getAcceptCard() != null ? reqPay.getAcceptCard() : currentPay.getAcceptCard())
                    .momoPhone(reqPay.getMomoPhone() != null ? reqPay.getMomoPhone() : currentPay.getMomoPhone())
                    .momoOwnerName(reqPay.getMomoOwnerName() != null ? reqPay.getMomoOwnerName() : currentPay.getMomoOwnerName())
                    .momoQrImage(reqPay.getMomoQrImage() != null ? reqPay.getMomoQrImage() : currentPay.getMomoQrImage())
                    .cardBankName(reqPay.getCardBankName() != null ? reqPay.getCardBankName() : currentPay.getCardBankName())
                    .cardNumber(reqPay.getCardNumber() != null ? reqPay.getCardNumber() : currentPay.getCardNumber())
                    .cardHolderName(reqPay.getCardHolderName() != null ? reqPay.getCardHolderName() : currentPay.getCardHolderName())
                    .cardExpiry(reqPay.getCardExpiry() != null ? reqPay.getCardExpiry() : currentPay.getCardExpiry())
                    .build();
            existing.setPaymentInfo(updatedPay);
        }
        Store updatedStore = storeRepository.save(existing);
        Double revenue = orderRepository.sumCompletedSalesByStoreId(updatedStore.getId());
        return enrichStoreEarnings(StoreMapper.toDTO(updatedStore), revenue);
    }

    private void deactivateOrphanedEmployeeIfApplicable(User u, Long ownerId) {
        if (u == null || u.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        boolean isOwner = ownerId != null && ownerId.equals(u.getId());
        if (!isOwner && u.getRole() != UserRole.ROLE_STORE_ADMIN) {
            u.setLoginAccess(false);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteStore(Long id) throws UserException {
        User currentUser = userService.getCurrentUser();
        Store store;
        if (id != null) {
            store = storeRepository.findById(id).orElseThrow(
                    () -> new UserException("Store not found with id: " + id)
            );
            boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(currentUser.getId());
            if (currentUser.getRole() != UserRole.ROLE_ADMIN && !isOwner) {
                throw new UserException("You do not have permission to delete this store");
            }
        } else {
            store = getStoreByAdmin();
            if (store == null) {
                throw new UserException("Store not found");
            }
        }

        Long storeId = store.getId();
        Long ownerId = store.getStoreAdmin() != null ? store.getStoreAdmin().getId() : null;

        // 1. Unlink users referencing this store or its branches & disable login for orphaned staff
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

        // 2. Clean up branches and their dependent records
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

        // 3. Clean up products and categories
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

        // 4. Clean up coupons and subscriptions
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
                c.setStore(null);
                customerRepository.save(c);
            }
        }

        storeRepository.delete(store);
    }

    @Override
    @Transactional(readOnly = true)
    public StoreDTO getStoreByEmployee() throws UserException {
        User currentUser = userService.getCurrentUserAllowingBlockedStore();
        if (currentUser == null) {
            throw new UserException("you don't have permission to access this store");
        }
        Store store = null;
        if (currentUser.getStore() != null) {
            store = currentUser.getStore();
        } else if (currentUser.getBranch() != null && currentUser.getBranch().getStore() != null) {
            store = currentUser.getBranch().getStore();
        } else {
            store = storeRepository.findByStoreAdminId(currentUser.getId());
        }
        if (store == null) {
            return null;
        }
        Double revenue = orderRepository.sumCompletedSalesByStoreId(store.getId());
        return enrichStoreEarnings(StoreMapper.toDTO(store), revenue);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public StoreDTO moderateStore(Long id, StoreStatus status) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() != UserRole.ROLE_ADMIN) {
            throw new AccessDeniedException("Super Admin privilege is required to moderate stores");
        }
        Store store = storeRepository.findById(id).orElseThrow(
                () -> new Exception("store not found...")
        );
        store.setStatus(status);
        Store updatedStore = storeRepository.save(store);
        Double revenue = orderRepository.sumCompletedSalesByStoreId(updatedStore.getId());
        return enrichStoreEarnings(StoreMapper.toDTO(updatedStore), revenue);
    }
}
