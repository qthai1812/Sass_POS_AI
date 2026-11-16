package com.zosh.payload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventorySummaryDTO {

    private long totalItems;
    private long totalQuantity;
    private long lowStockCount;
    private long outOfStockCount;
}
