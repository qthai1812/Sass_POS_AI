package com.zosh.service;

import com.zosh.payload.dto.SubscriptionPlanDTO;

import java.util.List;

public interface SubscriptionPlanService {

    SubscriptionPlanDTO createPlan(SubscriptionPlanDTO dto);

    SubscriptionPlanDTO updatePlan(Long id, SubscriptionPlanDTO dto) throws Exception;

    List<SubscriptionPlanDTO> getAllPlans();

    SubscriptionPlanDTO getPlanById(Long id) throws Exception;

    void deletePlan(Long id) throws Exception;
}
