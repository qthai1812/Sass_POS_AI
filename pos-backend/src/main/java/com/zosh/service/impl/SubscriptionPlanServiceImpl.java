package com.zosh.service.impl;

import com.zosh.domain.SubscriptionStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.SubscriptionPlan;
import com.zosh.modal.User;
import com.zosh.payload.dto.SubscriptionPlanDTO;
import com.zosh.repository.SubscriptionPlanRepository;
import com.zosh.repository.SubscriptionRepository;
import com.zosh.service.SubscriptionPlanService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubscriptionPlanServiceImpl implements SubscriptionPlanService {

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserService userService;

    private static final java.util.Set<String> BILLING_CYCLES = java.util.Set.of("MONTHLY", "YEARLY");

    private void assertSuperAdmin() {
        try {
            User current = userService.getCurrentUser();
            if (current == null || current.getRole() != UserRole.ROLE_SUPER_ADMIN) {
                throw new AccessDeniedException("Super Admin privilege is required to manage subscription plans");
            }
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("Super Admin privilege is required to manage subscription plans");
        }
    }

    private void validate(SubscriptionPlanDTO dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new IllegalArgumentException("Plan name is required");
        }
        if (dto.getPrice() == null || dto.getPrice() < 0) {
            throw new IllegalArgumentException("Plan price must be 0 or greater");
        }
        if (dto.getBillingCycle() == null || !BILLING_CYCLES.contains(dto.getBillingCycle().toUpperCase())) {
            throw new IllegalArgumentException("Billing cycle must be MONTHLY or YEARLY");
        }
    }

    private Integer normalizeLimit(Integer val) {
        return (val != null && val > 0) ? val : null;
    }

    private static boolean flag(Boolean value) {
        return Boolean.TRUE.equals(value);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionPlanDTO createPlan(SubscriptionPlanDTO dto) {
        assertSuperAdmin();
        validate(dto);
        SubscriptionPlan plan = toEntity(dto);
        SubscriptionPlan saved = subscriptionPlanRepository.save(plan);
        return toDTO(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SubscriptionPlanDTO updatePlan(Long id, SubscriptionPlanDTO dto) throws Exception {
        assertSuperAdmin();
        SubscriptionPlan plan = subscriptionPlanRepository.findById(id)
                .orElseThrow(() -> new Exception("Subscription plan not found with id: " + id));
        validate(dto);

        plan.setName(dto.getName());
        plan.setPrice(dto.getPrice());
        plan.setBillingCycle(dto.getBillingCycle().toUpperCase());
        plan.setMaxBranches(normalizeLimit(dto.getMaxBranches()));
        plan.setMaxUsers(normalizeLimit(dto.getMaxUsers()));
        plan.setMaxProducts(normalizeLimit(dto.getMaxProducts()));
        if (dto.getActive() != null) {
            plan.setActive(dto.getActive());
        }

        plan.setAdvancedReports(flag(dto.getAdvancedReports()));
        plan.setInventory(flag(dto.getInventory()));
        plan.setIntegrations(flag(dto.getIntegrations()));
        plan.setEcommerce(flag(dto.getEcommerce()));
        plan.setInvoiceBranding(flag(dto.getInvoiceBranding()));
        plan.setPrioritySupport(flag(dto.getPrioritySupport()));
        plan.setMultiLocation(flag(dto.getMultiLocation()));
        plan.setAiCopilot(flag(dto.getAiCopilot()));
        plan.setDescription(dto.getDescription());
        plan.setExtraFeatures(dto.getExtraFeatures() != null ? new java.util.ArrayList<>(dto.getExtraFeatures()) : new java.util.ArrayList<>());

        SubscriptionPlan updated = subscriptionPlanRepository.save(plan);
        return toDTO(updated);
    }

    @Override
    public List<SubscriptionPlanDTO> getAllPlans() {
        return subscriptionPlanRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public SubscriptionPlanDTO getPlanById(Long id) throws Exception {
        SubscriptionPlan plan = subscriptionPlanRepository.findById(id)
                .orElseThrow(() -> new Exception("Subscription plan not found with id: " + id));
        return toDTO(plan);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deletePlan(Long id) throws Exception {
        assertSuperAdmin();
        if (!subscriptionPlanRepository.existsById(id)) {
            throw new Exception("Subscription plan not found with id: " + id);
        }
        boolean inUse = subscriptionRepository.existsByPlanIdAndStatusIn(
                String.valueOf(id),
                List.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL)
        );
        if (inUse) {
            throw new IllegalArgumentException("This plan is used by stores with an active/trial subscription and cannot be deleted. Deactivate it instead.");
        }
        subscriptionPlanRepository.deleteById(id);
    }

    private SubscriptionPlanDTO toDTO(SubscriptionPlan plan) {
        return SubscriptionPlanDTO.builder()
                .id(plan.getId())
                .name(plan.getName())
                .price(plan.getPrice())
                .billingCycle(plan.getBillingCycle())
                .maxBranches(plan.getMaxBranches())
                .maxUsers(plan.getMaxUsers())
                .maxProducts(plan.getMaxProducts())
                .active(plan.getActive())
                .advancedReports(plan.getAdvancedReports())
                .inventory(plan.getInventory())
                .integrations(plan.getIntegrations())
                .ecommerce(plan.getEcommerce())
                .invoiceBranding(plan.getInvoiceBranding())
                .prioritySupport(plan.getPrioritySupport())
                .multiLocation(plan.getMultiLocation())
                .aiCopilot(plan.getAiCopilot())
                .description(plan.getDescription())
                .createdAt(plan.getCreatedAt())
                .updatedAt(plan.getUpdatedAt())
                .extraFeatures(plan.getExtraFeatures() != null ? new ArrayList<>(plan.getExtraFeatures()) : new ArrayList<>())
                .build();
    }

    private SubscriptionPlan toEntity(SubscriptionPlanDTO dto) {
        return SubscriptionPlan.builder()
                .name(dto.getName())
                .price(dto.getPrice())
                .billingCycle(dto.getBillingCycle().toUpperCase())
                .maxBranches(normalizeLimit(dto.getMaxBranches()))
                .maxUsers(normalizeLimit(dto.getMaxUsers()))
                .maxProducts(normalizeLimit(dto.getMaxProducts()))
                .active(dto.getActive() != null ? dto.getActive() : true)
                .advancedReports(flag(dto.getAdvancedReports()))
                .inventory(flag(dto.getInventory()))
                .integrations(flag(dto.getIntegrations()))
                .ecommerce(flag(dto.getEcommerce()))
                .invoiceBranding(flag(dto.getInvoiceBranding()))
                .prioritySupport(flag(dto.getPrioritySupport()))
                .multiLocation(flag(dto.getMultiLocation()))
                .aiCopilot(flag(dto.getAiCopilot()))
                .description(dto.getDescription())
                .extraFeatures(dto.getExtraFeatures() != null ? new java.util.ArrayList<>(dto.getExtraFeatures()) : new java.util.ArrayList<>())
                .build();
    }
}
