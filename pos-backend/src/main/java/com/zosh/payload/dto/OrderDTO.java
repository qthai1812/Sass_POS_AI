package com.zosh.payload.dto;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.modal.Customer;
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
public class OrderDTO {

    private Long id;

    private Double subTotal;

    private Double taxAmount;

    private Double discountAmount;

    private String couponCode;

    private Double totalAmount;

    private String note;

    private LocalDateTime createdAt;

    private Long branchId;

    private Long customerId;

    private BranchDTO branch;

    private UserDto cashier;

    private Customer customer;

    private PaymentType paymentType;

    private OrderStatus status;

    private List<OrderItemDTO> items;
}