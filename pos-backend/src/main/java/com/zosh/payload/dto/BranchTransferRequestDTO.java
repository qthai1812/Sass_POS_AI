package com.zosh.payload.dto;

import com.zosh.domain.BranchTransferRequestStatus;
import com.zosh.domain.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BranchTransferRequestDTO {
    private Long id;

    private Long employeeId;
    private String employeeName;
    private String employeeEmail;
    private String employeePhone;
    private UserRole employeeRole;

    private Long storeId;
    private String storeName;

    private Long fromBranchId;
    private String fromBranchName;

    private Long toBranchId;
    private String toBranchName;

    private String reason;
    private BranchTransferRequestStatus status;

    private String reviewNote;
    private Long reviewedById;
    private String reviewedByName;
    private LocalDateTime reviewedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
