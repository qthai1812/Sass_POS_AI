package com.zosh.mapper;

import com.zosh.modal.Customer;
import com.zosh.payload.dto.CustomerDTO;

/**
 * Maps Customer JPA entities to CustomerDTO objects.
 */
public final class CustomerMapper {

    private CustomerMapper() {
    }

    public static CustomerDTO toDTO(Customer customer) {
        if (customer == null) {
            return null;
        }
        return CustomerDTO.builder()
                .id(customer.getId())
                .fullName(customer.getFullName())
                .email(customer.getEmail())
                .phone(customer.getPhone())
                .loyaltyPoints(customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0)
                .storeId(customer.getStoreId())
                .createdAt(customer.getCreatedAt())
                .updatedAt(customer.getUpdatedAt())
                .build();
    }
}
