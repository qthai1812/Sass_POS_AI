package com.zosh.service;

import com.zosh.payload.dto.BranchTransferRequestDTO;

import java.util.List;

public interface BranchTransferRequestService {

    BranchTransferRequestDTO createRequest(Long toBranchId, String reason) throws Exception;

    List<BranchTransferRequestDTO> getMyRequests() throws Exception;

    BranchTransferRequestDTO cancelMyRequest(Long requestId) throws Exception;

    List<BranchTransferRequestDTO> getStoreRequests(Long storeId) throws Exception;

    BranchTransferRequestDTO reviewRequest(Long requestId, String action, String reviewNote) throws Exception;
}
