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

/**
 * Áp dụng quyền lợi của gói cước lên cửa hàng:
 * <ul>
 *   <li>Giới hạn số lượng: maxBranches / maxUsers / maxProducts;</li>
 *   <li>Tính năng cố định bật/tắt theo gói ({@link PlanFeature}).</li>
 * </ul>
 * Cửa hàng chưa có gói ACTIVE còn hạn (hoặc gói không xác định được) được xem là không giới hạn và có mọi tính năng;
 * giá trị giới hạn null hoặc &lt;= 0 cũng được hiểu là không giới hạn.
 */
@Component
@RequiredArgsConstructor
public class PlanLimitChecker {

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

    // ───────────────────────── Tính năng ─────────────────────────

    public boolean hasFeature(Store store, PlanFeature feature) {
        if (store == null) return true;
        Optional<SubscriptionPlan> plan = activePlan(store);
        return plan.isEmpty() || feature.isEnabledIn(plan.get());
    }

    public void requireFeature(Store store, PlanFeature feature) throws UserException {
        if (store == null) return;
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isPresent() && !feature.isEnabledIn(plan.get())) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" does not include \""
                    + feature.getLabel() + "\". Please upgrade your plan to use this feature.");
        }
    }

    // ───────────────────────── Giới hạn số lượng ─────────────────────────

    public void checkBranchLimit(Store store) throws UserException {
        if (store == null) return;
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isEmpty()) return;
        long current = branchRepository.countByStoreId(store.getId());
        // Gói không có Multi-location chỉ được phép có tối đa 1 chi nhánh
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
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isPresent()
                && exceeds(plan.get().getMaxProducts(), productRepository.countByStoreId(store.getId()))) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" allows at most "
                    + plan.get().getMaxProducts() + " products. Please upgrade your plan to add more.");
        }
    }

    public void checkUserLimit(Store store) throws UserException {
        if (store == null) return;
        Optional<SubscriptionPlan> plan = activePlan(store);
        if (plan.isPresent()
                && exceeds(plan.get().getMaxUsers(), userRepository.countByStore(store))) {
            throw new UserException("Your current plan \"" + plan.get().getName() + "\" allows at most "
                    + plan.get().getMaxUsers() + " users. Please upgrade your plan to add more.");
        }
    }

    /**
     * Chặn đăng ký/chuyển sang gói mới nếu mức sử dụng hiện tại của cửa hàng vượt quá giới hạn của gói đó
     * (ví dụ hạ cấp xuống gói ít chi nhánh/nhân viên/sản phẩm hơn mức đang dùng).
     */
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

    // ───────────────────────── Quyền lợi hiện hành ─────────────────────────

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
            features.put(f.getKey(), plan.isEmpty() || f.isEnabledIn(plan.get()));
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
        plan.ifPresent(p -> {
            dto.setPlanId(String.valueOf(p.getId()));
            dto.setPlanName(p.getName());
            dto.setMaxBranches(p.getMaxBranches() != null && p.getMaxBranches() > 0 ? p.getMaxBranches() : null);
            dto.setMaxUsers(p.getMaxUsers() != null && p.getMaxUsers() > 0 ? p.getMaxUsers() : null);
            dto.setMaxProducts(p.getMaxProducts() != null && p.getMaxProducts() > 0 ? p.getMaxProducts() : null);
        });
        return dto;
    }
}
