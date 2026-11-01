package com.zosh.controller;

import com.zosh.payload.response.DashboardSummaryDTO;
import com.zosh.payload.response.StoreRegistrationStatDTO;
import com.zosh.payload.response.StoreStatusDistributionDTO;
import com.zosh.service.SuperAdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@RequestMapping("/api/super-admin/dashboard")
public class SuperAdminDashboardController {

    private final SuperAdminDashboardService superAdminDashboardService;

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryDTO> getDashboardSummary() {
        return ResponseEntity.ok(superAdminDashboardService.getDashboardSummary());
    }

    @GetMapping("/store-registrations")
    public ResponseEntity<List<StoreRegistrationStatDTO>> getStoreRegistrationStats() {
        return ResponseEntity.ok(superAdminDashboardService.getStoreRegistrationStats());
    }

    @GetMapping("/store-status-distribution")
    public ResponseEntity<StoreStatusDistributionDTO> getStoreStatusDistribution() {
        return ResponseEntity.ok(superAdminDashboardService.getStoreStatusDistribution());
    }
}
