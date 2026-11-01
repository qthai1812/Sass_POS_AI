package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BranchPerformanceDTO {
    private Long branchId;
    private String branchName;
    private Double totalRevenue;
    private Integer totalOrders;
    private Integer totalEmployees;
    private Double avgOrderValue;
}
