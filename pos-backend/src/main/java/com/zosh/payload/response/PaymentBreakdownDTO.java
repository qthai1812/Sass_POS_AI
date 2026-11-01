package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentBreakdownDTO {
    private String paymentType;
    private Long totalOrders;
    private Double totalAmount;
    private Double percentage;
}
