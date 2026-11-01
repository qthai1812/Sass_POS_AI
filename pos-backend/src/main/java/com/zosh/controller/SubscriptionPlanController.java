package com.zosh.controller;

import com.zosh.payload.dto.SubscriptionPlanDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.SubscriptionPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/super-admin/subscription-plans")
public class SubscriptionPlanController {

    private final SubscriptionPlanService subscriptionPlanService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<SubscriptionPlanDTO> createPlan(
            @RequestBody SubscriptionPlanDTO dto) {
        return ResponseEntity.ok(subscriptionPlanService.createPlan(dto));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<SubscriptionPlanDTO> updatePlan(
            @PathVariable Long id,
            @RequestBody SubscriptionPlanDTO dto) throws Exception {
        return ResponseEntity.ok(subscriptionPlanService.updatePlan(id, dto));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<List<SubscriptionPlanDTO>> getAllPlans() {
        return ResponseEntity.ok(subscriptionPlanService.getAllPlans());
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}")
    public ResponseEntity<SubscriptionPlanDTO> getPlanById(
            @PathVariable Long id) throws Exception {
        return ResponseEntity.ok(subscriptionPlanService.getPlanById(id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deletePlan(
            @PathVariable Long id) throws Exception {
        subscriptionPlanService.deletePlan(id);
        ApiResponse response = new ApiResponse();
        response.setMessage("Subscription plan deleted successfully");
        return ResponseEntity.ok(response);
    }
}
