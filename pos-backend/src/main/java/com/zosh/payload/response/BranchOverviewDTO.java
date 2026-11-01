package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BranchOverviewDTO {
    private Double todayRevenue;
    private Integer todayOrders;
    private Double todayRefunds;
    private Integer activeShifts;
    private Integer lowStockItems;
    private Double avgOrderValue;
}
