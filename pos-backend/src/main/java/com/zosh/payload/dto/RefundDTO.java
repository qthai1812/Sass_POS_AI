package com.zosh.payload.dto;

import com.zosh.domain.PaymentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundDTO {

    private Long id;

    private OrderDTO order;
    @NotNull(message = "Order ID is required")
    private Long orderId;

    private String reason;

    @Positive(message = "Refund amount must be greater than 0")
    private Double amount;

    private Long shiftReportId;

    private UserDto cashier;
    private String cashierName;

    private BranchDTO branch;
    private Long branchId;

    private PaymentType paymentType;

    @Valid
    private List<RefundItemDTO> items;

    private LocalDateTime createdAt;
}
