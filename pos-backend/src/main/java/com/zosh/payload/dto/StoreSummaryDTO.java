package com.zosh.payload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoreSummaryDTO {

    private long totalStores;
    private long activeStores;
    private long pendingStores;
    private long blockedStores;
    private long rejectedStores;
    private double averageCommissionRate;
    private double totalEarnings;
}
