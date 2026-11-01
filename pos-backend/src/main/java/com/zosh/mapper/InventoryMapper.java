package com.zosh.mapper;

import com.zosh.modal.Branch;
import com.zosh.modal.Inventory;
import com.zosh.modal.Product;
import com.zosh.payload.dto.InventoryDTO;

public class InventoryMapper {

    public static InventoryDTO toDTO(Inventory inventory) {
        if (inventory == null) return null;
        return InventoryDTO.builder()
                .id(inventory.getId())
                .branchId(inventory.getBranch() != null ? inventory.getBranch().getId() : null)
                .productId(inventory.getProduct() != null ? inventory.getProduct().getId() : null)
                .product(inventory.getProduct() != null ? ProductMapper.toDTO(inventory.getProduct()) : null)
                .quantity(inventory.getQuantity())
                .minStockLevel(inventory.getMinStockLevel())
                .lastUpdate(inventory.getLastUpdate())
                .build();
    }

    public static Inventory toEntity(InventoryDTO inventoryDTO,
                                     Branch branch,
                                     Product product) {
        return Inventory.builder()
                .branch(branch)
                .product(product)
                .quantity(inventoryDTO.getQuantity())
                .minStockLevel(inventoryDTO.getMinStockLevel() != null ? inventoryDTO.getMinStockLevel() : 10)
                .build();
    }
}
