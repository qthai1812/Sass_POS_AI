package com.zosh.service;

import com.zosh.payload.dto.InventoryDTO;

import java.util.List;

public interface InventoryService {

    InventoryDTO createInventory(InventoryDTO inventoryDTO) throws Exception;
    InventoryDTO updateInventory(Long id, InventoryDTO inventoryDTO) throws Exception;
    void deleteInventory(Long id) throws Exception;
    InventoryDTO getInventoryById(Long id) throws Exception;
    InventoryDTO getInventoryByProductIdAndBranchId(Long productId, Long branchId);
    List<InventoryDTO> getInventoryByProductId(Long productId);
    List<InventoryDTO> getAllInventoryByBranchId(Long branchId);

    /** Trừ tồn kho sau khi thanh toán thành công (có pessimistic lock). */
    void deductInventory(Long productId, Long branchId, int quantity) throws Exception;

    /** Hoàn trả tồn kho khi refund (có pessimistic lock). */
    void restoreInventory(Long productId, Long branchId, int quantity) throws Exception;
}
