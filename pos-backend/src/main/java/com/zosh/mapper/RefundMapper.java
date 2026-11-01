package com.zosh.mapper;

import com.zosh.modal.Refund;
import com.zosh.modal.RefundItem;
import com.zosh.payload.dto.RefundDTO;
import com.zosh.payload.dto.RefundItemDTO;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class RefundMapper {

    public static RefundDTO toDTO(Refund refund) {
        if (refund == null) {
            return null;
        }
        return RefundDTO.builder()
                .id(refund.getId())
                .orderId(refund.getOrder() != null ? refund.getOrder().getId() : null)
                .reason(refund.getReason())
                .amount(refund.getAmount())
                .paymentType(refund.getPaymentType())
                .cashier(refund.getCashier() != null ? UserMapper.toDTO(refund.getCashier()) : null)
                .cashierName(refund.getCashier() != null ? refund.getCashier().getFullName() : null)
                .branchId(refund.getBranch() != null ? refund.getBranch().getId() : null)
                .shiftReportId(refund.getShiftReport() != null ? refund.getShiftReport().getId() : null)
                .items(mapItems(refund.getItems()))
                .createdAt(refund.getCreatedAt())
                .build();
    }

    private static List<RefundItemDTO> mapItems(List<RefundItem> items) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }
        return items.stream()
                .map(i -> RefundItemDTO.builder()
                        .id(i.getId())
                        .orderItemId(i.getOrderItemId())
                        .productId(i.getProductId())
                        .productName(i.getProductName())
                        .quantity(i.getQuantity())
                        .unitPrice(i.getUnitPrice())
                        .refundAmount(i.getRefundAmount())
                        .build())
                .collect(Collectors.toList());
    }
}
