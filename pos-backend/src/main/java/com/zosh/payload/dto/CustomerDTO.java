package com.zosh.payload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerDTO {

    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private Integer loyaltyPoints;
    private Long storeId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
