package com.zosh.service;

import com.zosh.domain.BranchTransferRequestStatus;
import com.zosh.payload.dto.BranchTransferRequestDTO;
import com.zosh.payload.dto.BranchTransferSummaryDTO;
import com.zosh.payload.response.PageResponse;

import java.util.List;

public interface BranchTransferRequestService {

    BranchTransferRequestDTO createRequest(Long toBranchId, String reason) throws Exception;

    List<BranchTransferRequestDTO> getMyRequests() throws Exception;

    BranchTransferRequestDTO cancelMyRequest(Long requestId) throws Exception;

    List<BranchTransferRequestDTO> getStoreRequests(Long storeId) throws Exception;

    PageResponse<BranchTransferRequestDTO> getStoreRequestsPaged(
            Long storeId,
            BranchTransferRequestStatus status,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) throws Exception;

    BranchTransferSummaryDTO getStoreRequestSummary(Long storeId) throws Exception;

    BranchTransferRequestDTO reviewRequest(Long requestId, String action, String reviewNote) throws Exception;
}
