package com.zosh.controller;

import com.zosh.domain.PaymentGateway;
import com.zosh.domain.SubscriptionStatus;
import com.zosh.payload.dto.PlanEntitlementsDTO;
import com.zosh.payload.dto.SubscriptionDTO;
import com.zosh.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    // POST /api/subscriptions/subscribe?storeId=&planId=&gateway=&transactionId=
    @PostMapping("/subscribe")
    public ResponseEntity<SubscriptionDTO> subscribe(
            @RequestParam Long storeId,
            @RequestParam String planId,
            @RequestParam(defaultValue = "RAZORPAY") PaymentGateway gateway,
            @RequestParam(required = false) String transactionId) throws Exception {
        return ResponseEntity.ok(subscriptionService.subscribe(storeId, planId, gateway, transactionId));
    }

    // POST /api/subscriptions/upgrade?storeId=&planId=&gateway=&transactionId=
    @PostMapping("/upgrade")
    public ResponseEntity<SubscriptionDTO> upgrade(
            @RequestParam Long storeId,
            @RequestParam String planId,
            @RequestParam(defaultValue = "RAZORPAY") PaymentGateway gateway,
            @RequestParam(required = false) String transactionId) throws Exception {
        return ResponseEntity.ok(subscriptionService.upgrade(storeId, planId, gateway, transactionId));
    }

    // PUT /api/subscriptions/{id}/activate
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/activate")
    public ResponseEntity<SubscriptionDTO> activate(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(subscriptionService.activate(id));
    }

    // PUT /api/subscriptions/{id}/cancel
    @PutMapping("/{id}/cancel")
    public ResponseEntity<SubscriptionDTO> cancel(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(subscriptionService.cancel(id));
    }

    // PUT /api/subscriptions/{id}/payment-status?status=
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/payment-status")
    public ResponseEntity<SubscriptionDTO> updatePaymentStatus(
            @PathVariable Long id,
            @RequestParam SubscriptionStatus status) throws Exception {
        return ResponseEntity.ok(subscriptionService.updatePaymentStatus(id, status));
    }

    // GET /api/subscriptions/entitlements  (quyền lợi của gói hiện hành cho cửa hàng của người dùng đăng nhập)
    @GetMapping("/entitlements")
    public ResponseEntity<PlanEntitlementsDTO> getMyEntitlements() throws Exception {
        return ResponseEntity.ok(subscriptionService.getMyEntitlements());
    }

    // GET /api/subscriptions/store/{storeId}?status=
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<SubscriptionDTO>> getStoreSubscriptions(
            @PathVariable Long storeId,
            @RequestParam(required = false) SubscriptionStatus status) throws Exception {
        return ResponseEntity.ok(subscriptionService.getStoreSubscriptions(storeId, status));
    }

    // GET /api/subscriptions/admin?status=
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin")
    public ResponseEntity<List<SubscriptionDTO>> getAllSubscriptions(
            @RequestParam(required = false) SubscriptionStatus status) throws Exception {
        return ResponseEntity.ok(subscriptionService.getAllSubscriptions(status));
    }

    // GET /api/subscriptions/admin/expiring?days=7
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/expiring")
    public ResponseEntity<List<SubscriptionDTO>> getExpiringSubscriptions(
            @RequestParam(defaultValue = "7") int days) throws Exception {
        return ResponseEntity.ok(subscriptionService.getExpiringSubscriptions(days));
    }

    // GET /api/subscriptions/admin/count?status=
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/count")
    public ResponseEntity<Long> countByStatus(
            @RequestParam SubscriptionStatus status) throws Exception {
        return ResponseEntity.ok(subscriptionService.countByStatus(status));
    }
}
