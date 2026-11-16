package com.zosh.payload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerSummaryDTO {

    private long totalCustomers;
    private long goldAndDiamondCount;
    private long totalLoyaltyPoints;
}
