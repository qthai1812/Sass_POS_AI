package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SalesTrendDTO {
    private String period;
    private Double totalSales;
    private Integer totalOrders;
    private Double growth;
}
