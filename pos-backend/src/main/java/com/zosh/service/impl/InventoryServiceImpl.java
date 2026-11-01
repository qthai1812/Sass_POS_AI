package com.zosh.service.impl;

import com.zosh.domain.PlanFeature;
import com.zosh.mapper.InventoryMapper;
import com.zosh.modal.Branch;
import com.zosh.modal.Inventory;
import com.zosh.modal.Product;
import com.zosh.payload.dto.InventoryDTO;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.InventoryService;
import com.zosh.service.PlanLimitChecker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final BranchRepository branchRepository;
    private final ProductRepository productRepository;
    private final AccessControlService accessControl;
    private final PlanLimitChecker planLimitChecker;

    /** Gói cước không có Inventory System: không quản lý/trừ kho, bán hàng không bị ràng buộc tồn kho. */
    private boolean inventoryDisabledForBranchId(Long branchId) {
        return branchRepository.findById(branchId)
                .map(b -> !planLimitChecker.hasFeature(b.getStore(), PlanFeature.INVENTORY))
                .orElse(false);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InventoryDTO createInventory(InventoryDTO inventoryDTO) throws Exception {
        if (inventoryDTO.getQuantity() == null || inventoryDTO.getQuantity() < 0) {
            throw new IllegalArgumentException("Inventory quantity must be 0 or greater");
        }
        Branch branch = branchRepository.findById(inventoryDTO.getBranchId()).orElseThrow(
                () -> new Exception("Branch not found with id: " + inventoryDTO.getBranchId())
        );
        accessControl.assertCanManageBranch(accessControl.currentUser(), branch);
        planLimitChecker.requireFeature(branch.getStore(), PlanFeature.INVENTORY);
        Product product = productRepository.findById(inventoryDTO.getProductId()).orElseThrow(
                () -> new Exception("Product not found with id: " + inventoryDTO.getProductId())
        );

        if (branch.getStore() != null && product.getStore() != null
                && !branch.getStore().getId().equals(product.getStore().getId())) {
            throw new IllegalArgumentException("Product and Branch do not belong to the same store");
        }

        List<Inventory> existingList = inventoryRepository.findAllByProductIdAndBranchId(
                inventoryDTO.getProductId(), inventoryDTO.getBranchId()
        );

        Inventory savedInventory;

        if (existingList.isEmpty()) {
            Inventory newInventory = InventoryMapper.toEntity(inventoryDTO, branch, product);
            savedInventory = inventoryRepository.save(newInventory);
            log.info("Created new inventory for product {} in branch {}", product.getId(), branch.getId());
        } else if (existingList.size() == 1) {
            Inventory existing = existingList.get(0);
            int newQty = (existing.getQuantity() != null ? existing.getQuantity() : 0) + inventoryDTO.getQuantity();
            existing.setQuantity(newQty);
            savedInventory = inventoryRepository.save(existing);
            log.info("Updated inventory id={} for product {} in branch {}. New qty: {}",
                    existing.getId(), product.getId(), branch.getId(), newQty);
        } else {
            int totalExistingQty = existingList.stream()
                    .mapToInt(i -> i.getQuantity() != null ? i.getQuantity() : 0)
                    .sum();
            int mergedQty = totalExistingQty + inventoryDTO.getQuantity();

            Inventory keeper = existingList.stream()
                    .min(Comparator.comparingLong(Inventory::getId))
                    .get();
            keeper.setQuantity(mergedQty);
            savedInventory = inventoryRepository.save(keeper);

            inventoryRepository.deleteDuplicates(
                    inventoryDTO.getProductId(),
                    inventoryDTO.getBranchId(),
                    keeper.getId()
            );
            log.warn("Merged {} duplicate inventory rows for product {} in branch {}. Total qty: {}",
                    existingList.size(), product.getId(), branch.getId(), mergedQty);
        }

        return InventoryMapper.toDTO(savedInventory);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InventoryDTO updateInventory(Long id, InventoryDTO inventoryDTO) throws Exception {
        if (inventoryDTO.getQuantity() == null || inventoryDTO.getQuantity() < 0) {
            throw new IllegalArgumentException("Inventory quantity must be 0 or greater");
        }
        Inventory inventory = inventoryRepository.findById(id).orElseThrow(
                () -> new Exception("Inventory not found with id: " + id)
        );
        accessControl.assertCanManageBranch(accessControl.currentUser(), inventory.getBranch());
        planLimitChecker.requireFeature(inventory.getBranch().getStore(), PlanFeature.INVENTORY);
        inventory.setQuantity(inventoryDTO.getQuantity());
        if (inventoryDTO.getMinStockLevel() != null && inventoryDTO.getMinStockLevel() >= 0) {
            inventory.setMinStockLevel(inventoryDTO.getMinStockLevel());
        }
        Inventory updatedInventory = inventoryRepository.save(inventory);
        return InventoryMapper.toDTO(updatedInventory);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteInventory(Long id) throws Exception {
        Inventory inventory = inventoryRepository.findById(id).orElseThrow(
                () -> new Exception("Inventory not found with id: " + id)
        );
        accessControl.assertCanManageBranch(accessControl.currentUser(), inventory.getBranch());
        planLimitChecker.requireFeature(inventory.getBranch().getStore(), PlanFeature.INVENTORY);
        inventoryRepository.delete(inventory);
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryDTO getInventoryById(Long id) throws Exception {
        Inventory inventory = inventoryRepository.findById(id).orElseThrow(
                () -> new Exception("Inventory not found with id: " + id)
        );
        accessControl.assertCanAccessBranch(accessControl.currentUser(), inventory.getBranch());
        return InventoryMapper.toDTO(inventory);
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryDTO getInventoryByProductIdAndBranchId(Long productId, Long branchId) {
        try {
            Branch branch = branchRepository.findById(branchId).orElse(null);
            if (branch == null || !accessControl.canAccessBranch(accessControl.currentUser(), branch)) {
                throw new org.springframework.security.access.AccessDeniedException("You do not have permission to access this branch");
            }
        } catch (org.springframework.security.access.AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new org.springframework.security.access.AccessDeniedException("You do not have permission to access this branch");
        }
        return inventoryRepository.findFirstByProductIdAndBranchId(productId, branchId)
                .map(InventoryMapper::toDTO)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryDTO> getInventoryByProductId(Long productId) {
        com.zosh.modal.User current;
        try {
            current = accessControl.currentUser();
        } catch (Exception e) {
            return java.util.Collections.emptyList();
        }
        List<Inventory> inventories = inventoryRepository.findByProductId(productId);
        return inventories.stream()
                .filter(inv -> accessControl.canAccessBranch(current, inv.getBranch()))
                .map(InventoryMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryDTO> getAllInventoryByBranchId(Long branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Branch not found with id: " + branchId));
        try {
            accessControl.assertCanAccessBranch(accessControl.currentUser(), branch);
        } catch (Exception e) {
            throw new org.springframework.security.access.AccessDeniedException(e.getMessage());
        }
        List<Inventory> inventories = inventoryRepository.findByBranchId(branchId);
        return inventories.stream()
                .map(InventoryMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deductInventory(Long productId, Long branchId, int quantity) throws Exception {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity to deduct must be greater than 0");
        }
        if (inventoryDisabledForBranchId(branchId)) {
            return;
        }
        List<Inventory> locked = inventoryRepository
                .findAllByProductIdAndBranchIdWithLock(productId, branchId);

        if (locked.isEmpty()) {
            throw new Exception("Inventory not found for product " + productId + " in branch " + branchId);
        }

        Inventory keeper = locked.get(0);
        if (locked.size() > 1) {
            int total = locked.stream().mapToInt(i -> i.getQuantity() != null ? i.getQuantity() : 0).sum();
            keeper.setQuantity(total);
            inventoryRepository.deleteDuplicates(productId, branchId, keeper.getId());
            log.warn("Auto-merged {} duplicates during deduct for product {}", locked.size(), productId);
        }

        int current = keeper.getQuantity() != null ? keeper.getQuantity() : 0;
        if (current < quantity) {
            throw new Exception("Insufficient stock for product " + productId
                    + ". Available: " + current + ", requested: " + quantity);
        }

        keeper.setQuantity(current - quantity);
        inventoryRepository.save(keeper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void restoreInventory(Long productId, Long branchId, int quantity) throws Exception {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity to restore must be greater than 0");
        }
        if (inventoryDisabledForBranchId(branchId)) {
            return;
        }
        List<Inventory> locked = inventoryRepository
                .findAllByProductIdAndBranchIdWithLock(productId, branchId);

        if (locked.isEmpty()) {
            throw new Exception("Inventory not found for product " + productId + " in branch " + branchId);
        }

        Inventory keeper = locked.get(0);
        if (locked.size() > 1) {
            int total = locked.stream().mapToInt(i -> i.getQuantity() != null ? i.getQuantity() : 0).sum();
            keeper.setQuantity(total);
            inventoryRepository.deleteDuplicates(productId, branchId, keeper.getId());
            log.warn("Auto-merged {} duplicates during restore for product {}", locked.size(), productId);
        }

        int current = keeper.getQuantity() != null ? keeper.getQuantity() : 0;
        keeper.setQuantity(current + quantity);
        inventoryRepository.save(keeper);
    }
}
