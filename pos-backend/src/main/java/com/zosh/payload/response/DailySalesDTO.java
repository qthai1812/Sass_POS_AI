package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailySalesDTO {
    private String date;
    private Double totalSales;
    private Integer totalOrders;
}
