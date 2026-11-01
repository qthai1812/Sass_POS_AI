package com.zosh.payload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundItemDTO {
    private Long id;
    private Long orderItemId;
    private Long productId;
    private String productName;
    private Integer quantity;
    private Double unitPrice;
    private Double refundAmount;
}
