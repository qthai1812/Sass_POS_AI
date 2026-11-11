package com.zosh.service;

import com.zosh.domain.PlanFeature;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Store;
import com.zosh.modal.Subscription;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.payload.dto.PlanEntitlementsDTO;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class PlanLimitChecker {

    // Hạn mức mặc định khi cửa hàng chưa đăng ký gói hoặc gói đã hết hạn (EXPIRED)
    private static final int UNSUBSCRIBED_MAX_BRANCHES = 1;
    private static final int UNSUBSCRIBED_MAX_USERS = 3;
    private static final int UNSUBSCRIBED_MAX_PRODUCTS = 30;

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public Optional<Subscription> activeSubscription(Store store) {
        if (store == null) {
            return Optional.empty();
        }
        LocalDateTime now = LocalDateTime.now();
        return subscriptionRepository.findByStoreId(store.getId()).stream()
                .filter(s -> s.getStatus() == SubscriptionStatus.ACTIVE || s.getStatus() == SubscriptionStatus.TRIAL)
                .filter(s -> s.getEndDate() == null || s.getEndDate().isAfter(now))
                .max(Comparator.comparing(Subscription::getStartDate,
                        Comparator.nullsFirst(Comparator.naturalOrder())));
    }

    public Optional<SubscriptionPlan> activePlan(Store store) {
        return activeSubscription(store).flatMap(s -> {
            if (s.getPlanId() == null) {
                return Optional.empty();
            }
            try {
                return subscriptionPlanRepository.findById(Long.parseLong(s.getPlanId().trim()));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        });
    }

    private boolean exceeds(Integer limit, long current) {
        return limit != null && limit > 0 && current >= limit;
    }

    private boolean over(Integer limit, long current) {
        return limit != null && limit > 0 && current > limit;
    }

    public boolean hasFeature(Store store, PlanFeature feature) {
        if (store == null) return false;
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            // Khi chưa có gói hoặc gói hết hạn: khóa toàn bộ tính năng phân hệ (bao gồm cả INVENTORY)
            return false;
        }
        return feature.isEnabledIn(plan.get());
    }

    public void requireFeature(Store store, PlanFeature feature) throws UserException {
        if (store == null) return;
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            if (!hasFeature(store, feature)) {
                throw new UserException("Cửa hàng chưa có gói đăng ký đang hoạt động. Vui lòng đăng ký gói có tính năng \""
                        + feature.getLabel() + "\" để sử dụng.");
            }
            return;
        }
        if (!feature.isEnabledIn(plan.get())) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" does not include \""
                    + feature.getLabel() + "\". Please upgrade your plan to use this feature.");
        }
    }

    public void requireActivePlanFeature(Store store, PlanFeature feature) throws UserException {
        if (store == null) {
            throw new UserException("Store not found for verifying subscription plan.");
        }
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            throw new UserException("Cửa hàng chưa có gói đăng ký đang hoạt động. Vui lòng đăng ký gói có tính năng \""
                    + feature.getLabel() + "\" để sử dụng.");
        }
        if (!feature.isEnabledIn(plan.get())) {
            throw new UserException("Gói hiện tại \"" + plan.get().getName() + "\" không bao gồm tính năng \""
                    + feature.getLabel() + "\". Vui lòng nâng cấp gói để sử dụng.");
        }
    }

    public void checkBranchLimit(Store store) throws UserException {
        if (store == null) return;
        long current = branchRepository.countByStoreId(store.getId());
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            if (current >= UNSUBSCRIBED_MAX_BRANCHES) {
                throw new UserException("Cửa hàng chưa đăng ký gói cước chỉ được tạo tối đa "
                        + UNSUBSCRIBED_MAX_BRANCHES + " chi nhánh. Vui lòng nâng cấp gói để mở thêm chi nhánh.");
            }
            return;
        }
        if (!PlanFeature.MULTI_LOCATION.isEnabledIn(plan.get()) && current >= 1) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" does not include \""
                    + PlanFeature.MULTI_LOCATION.getLabel() + "\" and allows only 1 branch. "
                    + "Please upgrade your plan to add more.");
        }
        if (exceeds(plan.get().getMaxBranches(), current)) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" allows at most "
                    + plan.get().getMaxBranches() + " branches. Please upgrade your plan to add more.");
        }
    }

    public void checkProductLimit(Store store) throws UserException {
        if (store == null) return;
        long current = productRepository.countByStoreId(store.getId());
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            if (current >= UNSUBSCRIBED_MAX_PRODUCTS) {
                throw new UserException("Cửa hàng chưa đăng ký gói cước chỉ được tạo tối đa "
                        + UNSUBSCRIBED_MAX_PRODUCTS + " sản phẩm. Vui lòng nâng cấp gói để thêm sản phẩm.");
            }
            return;
        }
        if (exceeds(plan.get().getMaxProducts(), current)) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" allows at most "
                    + plan.get().getMaxProducts() + " products. Please upgrade your plan to add more.");
        }
    }

    public void checkUserLimit(Store store) throws UserException {
        if (store == null) return;
        long current = userRepository.countByStore(store);
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) {
            if (current >= UNSUBSCRIBED_MAX_USERS) {
                throw new UserException("Cửa hàng chưa đăng ký gói cước chỉ được tạo tối đa "
                        + UNSUBSCRIBED_MAX_USERS + " nhân sự. Vui lòng nâng cấp gói để thêm nhân viên.");
            }
            return;
        }
        if (exceeds(plan.get().getMaxUsers(), current)) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" allows at most "
                    + plan.get().getMaxUsers() + " users. Please upgrade your plan to add more.");
        }
    }

    public void assertCanSwitchTo(Store store, SubscriptionPlan target) throws UserException {
        if (store == null || target == null) return;
        long branches = branchRepository.countByStoreId(store.getId());
        long products = productRepository.countByStoreId(store.getId());
        long users = userRepository.countByStore(store);

        if (over(target.getMaxBranches(), branches)) {
            throw new UserException("Cannot switch to \"" + target.getName() + "\": the store has " + branches
                    + " branches but the plan allows at most " + target.getMaxBranches() + ". Remove some branches first.");
        }
        if (!PlanFeature.MULTI_LOCATION.isEnabledIn(target) && branches > 1) {
            throw new UserException("Cannot switch to \"" + target.getName() + "\": it does not include \""
                    + PlanFeature.MULTI_LOCATION.getLabel() + "\" (1 branch only) but the store has " + branches
                    + " branches. Remove some branches first.");
        }
        if (over(target.getMaxUsers(), users)) {
            throw new UserException("Cannot switch to \"" + target.getName() + "\": the store has " + users
                    + " users but the plan allows at most " + target.getMaxUsers() + ". Remove some users first.");
        }
        if (over(target.getMaxProducts(), products)) {
            throw new UserException("Cannot switch to \"" + target.getName() + "\": the store has " + products
                    + " products but the plan allows at most " + target.getMaxProducts() + ". Remove some products first.");
        }
    }

    public PlanEntitlementsDTO entitlements(Store store) {
        Optional<Subscription> activeSub = activeSubscription(store);
        Optional<SubscriptionPlan> plan = activeSub.flatMap(s -> {
            if (s.getPlanId() == null) {
                return Optional.empty();
            }
            try {
                return subscriptionPlanRepository.findById(Long.parseLong(s.getPlanId().trim()));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        });

        Map<String, Boolean> features = new LinkedHashMap<>();
        for (PlanFeature f : PlanFeature.values()) {
            boolean enabled = plan.isPresent() && f.isEnabledIn(plan.get());
            features.put(f.getKey(), enabled);
        }

        PlanEntitlementsDTO dto = new PlanEntitlementsDTO();
        dto.setFeatures(features);
        dto.setSubscribed(plan.isPresent());
        activeSub.ifPresent(sub -> dto.setEndDate(sub.getEndDate()));

        if (store != null) {
            dto.setStoreId(store.getId());
            dto.setStoreName(store.getBrand());
            dto.setUsedBranches((int) branchRepository.countByStoreId(store.getId()));
            dto.setUsedProducts((int) productRepository.countByStoreId(store.getId()));
            dto.setUsedUsers((int) userRepository.countByStore(store));
        }

        if (plan.isPresent()) {
            SubscriptionPlan p = plan.get();
            dto.setPlanId(String.valueOf(p.getId()));
            dto.setPlanName(p.getName());
            dto.setMaxBranches(p.getMaxBranches() != null && p.getMaxBranches() > 0 ? p.getMaxBranches() : null);
            dto.setMaxUsers(p.getMaxUsers() != null && p.getMaxUsers() > 0 ? p.getMaxUsers() : null);
            dto.setMaxProducts(p.getMaxProducts() != null && p.getMaxProducts() > 0 ? p.getMaxProducts() : null);
        } else {
            dto.setPlanName("Free Starter (Chưa đăng ký gói)");
            dto.setMaxBranches(UNSUBSCRIBED_MAX_BRANCHES);
            dto.setMaxUsers(UNSUBSCRIBED_MAX_USERS);
            dto.setMaxProducts(UNSUBSCRIBED_MAX_PRODUCTS);
        }

        return dto;
    }
}
