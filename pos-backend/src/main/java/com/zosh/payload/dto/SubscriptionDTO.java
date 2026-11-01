package com.zosh.payload.dto;

import com.zosh.domain.PaymentGateway;
import com.zosh.domain.SubscriptionStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionDTO {
    private Long id;
    private Long storeId;
    private String storeName;
    private String planName;
    private String planId;
    private SubscriptionStatus status;
    private PaymentGateway gateway;
    private String transactionId;
    private String checkoutUrl;
    private Double amount;
    private String currency;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime createdAt;
}
