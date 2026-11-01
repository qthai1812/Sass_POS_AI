package com.zosh.mapper;

import com.zosh.modal.Order;
import com.zosh.payload.dto.OrderDTO;

import java.util.Collections;
import java.util.stream.Collectors;

public class OrderMapper {

    public static OrderDTO toDTO(Order order) {
        if (order == null) {
            return null;
        }
        return OrderDTO.builder()
                .id(order.getId())
                .subTotal(order.getSubTotal())
                .taxAmount(order.getTaxAmount())
                .discountAmount(order.getDiscountAmount())
                .couponCode(order.getCouponCode())
                .totalAmount(order.getTotalAmount())
                .note(order.getNote())
                .branchId(order.getBranch() != null ? order.getBranch().getId() : null)
                .customerId(order.getCustomer() != null ? order.getCustomer().getId() : null)
                .cashier(order.getCashier() != null ? UserMapper.toDTO(order.getCashier()) : null)
                .customer(order.getCustomer())
                .paymentType(order.getPaymentType())
                .status(order.getStatus())
                .createdAt(order.getCreatedAt())
                .items(order.getItems() != null
                        ? order.getItems().stream()
                        .map(OrderItemMapper::toDTO)
                        .collect(Collectors.toList())
                        : Collections.emptyList())
                .build();
    }
}