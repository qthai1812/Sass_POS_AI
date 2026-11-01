package com.zosh.mapper;

import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.payload.dto.BranchDTO;

import java.time.LocalDateTime;
import java.util.ArrayList;

public class BranchMapper {

    public static BranchDTO toDTO(Branch branch) {
        if (branch == null) {
            return null;
        }
        return BranchDTO.builder()
                .id(branch.getId())
                .name(branch.getName())
                .address(branch.getAddress())
                .phone(branch.getPhone())
                .email(branch.getEmail())
                .closeTime(branch.getCloseTime())
                .openTime(branch.getOpenTime())
                .workingDays(branch.getWorkingDays() != null ? new ArrayList<>(branch.getWorkingDays()) : new ArrayList<>())
                .storeId(branch.getStore() != null ? branch.getStore().getId() : null)
                .manager(branch.getManager() != null ? UserMapper.toDTO(branch.getManager()) : null)
                .managerName(branch.getManager() != null ? branch.getManager().getFullName() : null)
                .createdAt(branch.getCreatedAt())
                .updatedAt(branch.getUpdatedAt())
                .build();
    }

    public static Branch toEntity(BranchDTO branchDTO, Store store) {
        return Branch.builder()
                .name(branchDTO.getName())
                .address(branchDTO.getAddress())
                .store(store)
                .email(branchDTO.getEmail())
                .phone(branchDTO.getPhone())
                .closeTime(branchDTO.getCloseTime())
                .openTime(branchDTO.getOpenTime())
                .workingDays(branchDTO.getWorkingDays())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
