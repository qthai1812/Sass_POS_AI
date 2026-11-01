package com.zosh.repository;

import com.zosh.modal.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {

    List<SubscriptionPlan> findByActiveTrue();

    List<SubscriptionPlan> findByBillingCycle(String billingCycle);
}
