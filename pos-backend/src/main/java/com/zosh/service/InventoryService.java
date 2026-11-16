package com.zosh.service;

import com.zosh.payload.dto.InventoryDTO;
import com.zosh.payload.dto.InventorySummaryDTO;
import com.zosh.payload.response.PageResponse;

import java.util.List;

public interface InventoryService {

    InventoryDTO createInventory(InventoryDTO inventoryDTO) throws Exception;
    InventoryDTO updateInventory(Long id, InventoryDTO inventoryDTO) throws Exception;
    void deleteInventory(Long id) throws Exception;
    InventoryDTO getInventoryById(Long id) throws Exception;
    InventoryDTO getInventoryByProductIdAndBranchId(Long productId, Long branchId);
    List<InventoryDTO> getInventoryByProductId(Long productId);
    List<InventoryDTO> getAllInventoryByBranchId(Long branchId);
    PageResponse<InventoryDTO> getInventoryByBranchPaged(
            Long branchId,
            String keyword,
            String category,
            int page,
            int size,
            String sortBy,
            String sortDir
    );
    InventorySummaryDTO getInventorySummaryByBranch(Long branchId, String keyword, String category);

    /** Trừ tồn kho sau khi thanh toán thành công (có pessimistic lock). */
    void deductInventory(Long productId, Long branchId, int quantity) throws Exception;

    /** Hoàn trả tồn kho khi refund (có pessimistic lock). */
    void restoreInventory(Long productId, Long branchId, int quantity) throws Exception;

    /** Chuyển tồn kho nội bộ giữa 2 chi nhánh thuộc cùng 1 Store (có Pessimistic Lock). */
    void transferInventory(Long productId, Long fromBranchId, Long toBranchId, int quantity) throws Exception;
}
