package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TopCashierDTO {
    private Long cashierId;
    private String cashierName;
    private Double totalRevenue;
    private Integer totalOrders;
}
