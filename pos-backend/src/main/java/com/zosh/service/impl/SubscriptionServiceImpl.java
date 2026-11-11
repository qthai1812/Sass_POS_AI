package com.zosh.service.impl;

import com.zosh.domain.PaymentGateway;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Store;
import com.zosh.modal.Subscription;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.modal.User;
import com.zosh.payload.dto.PlanEntitlementsDTO;
import com.zosh.payload.dto.SubscriptionDTO;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.PaymentGatewayService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.SubscriptionService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionServiceImpl implements SubscriptionService {

    private static final List<SubscriptionStatus> ACTIVE_OR_TRIAL = List.of(
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL
    );

    private final SubscriptionRepository subscriptionRepository;
    private final StoreRepository storeRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserService userService;
    private final PlanLimitChecker planLimitChecker;
    private final PaymentGatewayService paymentGatewayService;

    private void assertSuperAdmin() throws Exception {
        User user = userService.getCurrentUser();
        if (user == null || user.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin privilege is required");
        }
    }

    /** Chỉ Super Admin hoặc Chủ cửa hàng (ROLE_STORE_OWNER) của chính cửa hàng đó mới được thao tác gói cước. */
    private void assertCanBillStore(Store store) throws Exception {
        User user = userService.getCurrentUser();
        if (user.getRole() == UserRole.ROLE_SUPER_ADMIN) return;
        boolean isOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isStoreOwner = user.getRole() == UserRole.ROLE_STORE_OWNER
                && user.getStore() != null && user.getStore().getId().equals(store.getId());
        if (!isOwner && !isStoreOwner) {
            throw new AccessDeniedException("You do not have permission to manage subscriptions of this store");
        }
    }

    private SubscriptionDTO toDTO(Subscription s) {
        SubscriptionDTO dto = new SubscriptionDTO();
        dto.setId(s.getId());
        if (s.getStore() != null) {
            dto.setStoreId(s.getStore().getId());
            dto.setStoreName(s.getStore().getBrand());
        }
        dto.setPlanName(s.getPlanName());
        dto.setPlanId(s.getPlanId());
        dto.setStatus(s.getStatus());
        dto.setGateway(s.getGateway());
        dto.setTransactionId(s.getTransactionId());
        dto.setCheckoutUrl(s.getCheckoutUrl());
        dto.setAmount(s.getAmount());
        dto.setCurrency(s.getCurrency());
        dto.setStartDate(s.getStartDate());
        dto.setEndDate(s.getEndDate());
        dto.setCreatedAt(s.getCreatedAt());
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionDTO subscribe(Long storeId, String planId, PaymentGateway gateway, String transactionId) throws Exception {
        if (planId == null || planId.isBlank()) {
            throw new IllegalArgumentException("Subscription planId is required");
        }
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new Exception("Store not found: " + storeId));
        User currentUser = userService.getCurrentUser();
        assertCanBillStore(store);

        if (currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            if (store.getStatus() == StoreStatus.BLOCKED) {
                throw new Exception("Cửa hàng đang bị tạm khóa (BLOCKED) và không thể đăng ký/nâng cấp gói cước.");
            }
            if (store.getStatus() == StoreStatus.PENDING || store.getStatus() == StoreStatus.REJECTED) {
                throw new Exception("Cửa hàng đang chờ Super Admin phê duyệt nên chưa thể mua hoặc nâng cấp gói cước.");
            }
        }

        SubscriptionPlan matchedPlan = resolvePlan(planId);
        if (matchedPlan == null && currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            throw new IllegalArgumentException("Valid subscription plan ID is required");
        }
        if (matchedPlan != null && Boolean.FALSE.equals(matchedPlan.getActive())) {
            throw new Exception("Subscription plan is no longer available: " + matchedPlan.getName());
        }
        // Không cho đăng ký/hạ cấp sang gói có giới hạn thấp hơn mức cửa hàng đang sử dụng
        planLimitChecker.assertCanSwitchTo(store, matchedPlan);

        Double amount = matchedPlan != null && matchedPlan.getPrice() != null ? matchedPlan.getPrice() : 0.0;
        String verifiedTxId = transactionId != null ? transactionId.trim() : null;

        // Xác minh giao dịch thanh toán thực tế với PaymentGatewayService cho mọi gói trả phí (chống bypass kích hoạt miễn phí)
        if (amount > 0 && currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
            if (verifiedTxId == null || verifiedTxId.isEmpty()) {
                throw new AccessDeniedException("Payment transactionId is required for paid subscription plan");
            }
            if (subscriptionRepository.existsByTransactionId(verifiedTxId)) {
                throw new AccessDeniedException("Payment transactionId has already been used: " + verifiedTxId);
            }
            paymentGatewayService.verifyAndConsumeSubscriptionPayment(verifiedTxId, amount);
        } else {
            if (currentUser.getRole() != UserRole.ROLE_SUPER_ADMIN) {
                boolean alreadyUsedFreePlan = subscriptionRepository.findByStoreId(storeId).stream()
                        .anyMatch(s -> (s.getAmount() == null || s.getAmount() <= 0)
                                && s.getStatus() != SubscriptionStatus.PENDING);
                if (alreadyUsedFreePlan) {
                    throw new com.zosh.exceptions.UserException(
                            "Mỗi cửa hàng chỉ được đăng ký gói dùng thử / miễn phí (0₫) một lần duy nhất. Vui lòng chọn gói trả phí để gia hạn."
                    );
                }
            }
            if (verifiedTxId == null || verifiedTxId.isEmpty()) {
                verifiedTxId = "FREE-" + System.currentTimeMillis();
            }
        }

        // Hủy cả các gói ACTIVE lẫn TRIAL cũ của cửa hàng trước khi kích hoạt gói mới
        List<Subscription> existingSubs = subscriptionRepository.findByStoreIdAndStatusIn(storeId, ACTIVE_OR_TRIAL);
        for (Subscription oldSub : existingSubs) {
            oldSub.setStatus(SubscriptionStatus.CANCELLED);
            subscriptionRepository.save(oldSub);
        }

        String resolvedName = matchedPlan != null ? matchedPlan.getName() : resolvePlanName(planId);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endDate = (matchedPlan != null && "YEARLY".equalsIgnoreCase(matchedPlan.getBillingCycle()))
                ? now.plusYears(1)
                : now.plusMonths(1);

        Subscription subscription = Subscription.builder()
                .store(store)
                .planId(planId.trim())
                .planName(resolvedName)
                .amount(amount)
                .status(SubscriptionStatus.ACTIVE)
                .gateway(gateway != null ? gateway : PaymentGateway.RAZORPAY)
                .transactionId(verifiedTxId)
                .startDate(now)
                .endDate(endDate)
                .currency("VND")
                .build();

        return toDTO(subscriptionRepository.save(subscription));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionDTO upgrade(Long storeId, String planId, PaymentGateway gateway, String transactionId) throws Exception {
        return subscribe(storeId, planId, gateway, transactionId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionDTO activate(Long subscriptionId) throws Exception {
        assertSuperAdmin();
        Subscription sub = subscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new Exception("Subscription not found: " + subscriptionId));

        SubscriptionPlan matchedPlan = resolvePlan(sub.getPlanId());
        if (matchedPlan != null) {
            if (Boolean.FALSE.equals(matchedPlan.getActive())) {
                throw new Exception("Subscription plan is no longer available: " + matchedPlan.getName());
            }
            planLimitChecker.assertCanSwitchTo(sub.getStore(), matchedPlan);
        }

        // Mỗi cửa hàng chỉ được có tối đa 1 gói hiệu lực: hủy các gói ACTIVE và TRIAL khác trước khi kích hoạt
        List<Subscription> others = subscriptionRepository
                .findByStoreIdAndStatusIn(sub.getStore().getId(), ACTIVE_OR_TRIAL);
        for (Subscription other : others) {
            if (!other.getId().equals(sub.getId())) {
                other.setStatus(SubscriptionStatus.CANCELLED);
                subscriptionRepository.save(other);
            }
        }

        sub.setStatus(SubscriptionStatus.ACTIVE);
        LocalDateTime now = LocalDateTime.now();
        sub.setStartDate(now);

        boolean isYearly = matchedPlan != null && "YEARLY".equalsIgnoreCase(matchedPlan.getBillingCycle());
        sub.setEndDate(isYearly ? now.plusYears(1) : now.plusMonths(1));
        return toDTO(subscriptionRepository.save(sub));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionDTO cancel(Long subscriptionId) throws Exception {
        Subscription sub = subscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new Exception("Subscription not found: " + subscriptionId));
        assertCanBillStore(sub.getStore());
        sub.setStatus(SubscriptionStatus.CANCELLED);
        return toDTO(subscriptionRepository.save(sub));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionDTO updatePaymentStatus(Long subscriptionId, SubscriptionStatus status) throws Exception {
        assertSuperAdmin();
        if (status == SubscriptionStatus.ACTIVE) {
            return activate(subscriptionId);
        }
        Subscription sub = subscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new Exception("Subscription not found: " + subscriptionId));
        sub.setStatus(status);
        return toDTO(subscriptionRepository.save(sub));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int expireOverdueSubscriptions() {
        List<Subscription> overdue = subscriptionRepository
                .findByEndDateBeforeAndStatusIn(LocalDateTime.now(), ACTIVE_OR_TRIAL);
        for (Subscription sub : overdue) {
            sub.setStatus(SubscriptionStatus.EXPIRED);
            subscriptionRepository.save(sub);
        }
        if (!overdue.isEmpty()) {
            log.info("Marked {} overdue ACTIVE/TRIAL subscription(s) as EXPIRED", overdue.size());
        }
        return overdue.size();
    }

    private SubscriptionPlan resolvePlan(String planId) throws Exception {
        if (planId == null) {
            return null;
        }
        Long numericPlanId;
        try {
            numericPlanId = Long.parseLong(planId.trim());
        } catch (NumberFormatException e) {
            return null;
        }
        return subscriptionPlanRepository.findById(numericPlanId)
                .orElseThrow(() -> new Exception("Subscription plan not found: " + planId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubscriptionDTO> getStoreSubscriptions(Long storeId, SubscriptionStatus status) throws Exception {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new Exception("Store not found: " + storeId));
        User user = userService.getCurrentUser();
        boolean sameStore = user.getStore() != null && user.getStore().getId().equals(storeId);
        if (user.getRole() != UserRole.ROLE_SUPER_ADMIN && !sameStore
                && !(store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId()))) {
            throw new AccessDeniedException("You do not have permission to view subscriptions of this store");
        }
        List<Subscription> subs = status != null
                ? subscriptionRepository.findByStoreIdAndStatus(storeId, status)
                : subscriptionRepository.findByStoreId(storeId);
        return subs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubscriptionDTO> getAllSubscriptions(SubscriptionStatus status) throws Exception {
        assertSuperAdmin();
        List<Subscription> subs = status != null
                ? subscriptionRepository.findByStatus(status)
                : subscriptionRepository.findAll();
        return subs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubscriptionDTO> getExpiringSubscriptions(int days) throws Exception {
        assertSuperAdmin();
        LocalDateTime cutoff = LocalDateTime.now().plusDays(days);
        return subscriptionRepository.findByEndDateBeforeAndStatusIn(cutoff, ACTIVE_OR_TRIAL)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public long countByStatus(SubscriptionStatus status) throws Exception {
        assertSuperAdmin();
        return subscriptionRepository.countByStatus(status);
    }

    @Override
    @Transactional(readOnly = true)
    public PlanEntitlementsDTO getMyEntitlements() throws Exception {
        User user = userService.getCurrentUser();
        Store store = user.getStore();
        if (store == null && user.getBranch() != null) {
            store = user.getBranch().getStore();
        }
        if (store == null) {
            store = storeRepository.findByStoreAdminId(user.getId());
        }
        return planLimitChecker.entitlements(store);
    }

    private String resolvePlanName(String planId) {
        if (planId == null) return "Basic";
        switch (planId.toLowerCase()) {
            case "basic": return "Basic Plan";
            case "pro": return "Pro Plan";
            case "enterprise": return "Enterprise Plan";
            case "trial": return "Trial Plan";
            default: return planId;
        }
    }
}
