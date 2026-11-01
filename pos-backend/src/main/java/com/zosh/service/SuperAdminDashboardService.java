package com.zosh.service;

import com.zosh.payload.response.DashboardSummaryDTO;
import com.zosh.payload.response.StoreRegistrationStatDTO;
import com.zosh.payload.response.StoreStatusDistributionDTO;

import java.util.List;

public interface SuperAdminDashboardService {

    DashboardSummaryDTO getDashboardSummary();

    List<StoreRegistrationStatDTO> getStoreRegistrationStats();

    StoreStatusDistributionDTO getStoreStatusDistribution();
}
