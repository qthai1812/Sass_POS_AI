package com.zosh.payload.dto;

import com.zosh.domain.StoreStatus;
import com.zosh.modal.StoreContact;
import com.zosh.modal.StorePaymentInfo;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class StoreDTO {
    private Long id;

    private String brand;

    private UserDto storeAdmin;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String description;

    private String storeType;

    private StoreStatus status;

    private String rejectionReason;

    private Double commissionRate;

    private Double totalRevenue;

    private Double totalEarnings;

    private String currency;

    private Double taxRate;

    private String timezone;

    private String dateFormat;

    private String receiptFooter;

    private StoreContact contact;

    private StorePaymentInfo paymentInfo;
}
