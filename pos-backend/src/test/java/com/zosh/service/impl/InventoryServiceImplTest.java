package com.zosh.service.impl;

import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Inventory;
import com.zosh.modal.Product;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.InventoryDTO;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.PlanLimitChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceImplTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private ProductRepository productRepository;
    @Mock private AccessControlService accessControl;
    @Mock private PlanLimitChecker planLimitChecker;

    @InjectMocks
    private InventoryServiceImpl inventoryService;

    private Store store;
    private Branch branch;
    private Product product;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Test Store");
        branch = Branch.builder().id(10L).name("Branch 1").store(store).build();
        product = Product.builder().id(5L).name("Shirt").sku("SKU-5").build();
    }

    @Test
    void restoreInventory_whenExistingRowPresent_addsReturnedQuantity() throws Exception {
        Inventory existing = Inventory.builder().id(99L).branch(branch).product(product).quantity(12).build();
        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)).thenReturn(true);
        when(inventoryRepository.findAllByProductIdAndBranchIdWithLock(5L, 10L)).thenReturn(List.of(existing));

        inventoryService.restoreInventory(5L, 10L, 3);

        assertEquals(15, existing.getQuantity());
        verify(inventoryRepository).save(existing);
    }

    @Test
    void restoreInventory_whenRowMissingInBranch_autoCreatesInventoryRowInsteadOfFailing() throws Exception {
        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)).thenReturn(true);
        when(inventoryRepository.findAllByProductIdAndBranchIdWithLock(5L, 10L)).thenReturn(Collections.emptyList());
        when(productRepository.findById(5L)).thenReturn(Optional.of(product));

        inventoryService.restoreInventory(5L, 10L, 2);

        ArgumentCaptor<Inventory> captor = ArgumentCaptor.forClass(Inventory.class);
        verify(inventoryRepository).save(captor.capture());
        assertEquals(2, captor.getValue().getQuantity());
        assertEquals(branch, captor.getValue().getBranch());
        assertEquals(product, captor.getValue().getProduct());
    }

    @Test
    void deductInventory_whenRowMissingInBranch_stillThrowsException() {
        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)).thenReturn(true);
        when(inventoryRepository.findAllByProductIdAndBranchIdWithLock(5L, 10L)).thenReturn(Collections.emptyList());

        assertThrows(Exception.class, () -> inventoryService.deductInventory(5L, 10L, 2));
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void createInventory_byStoreOwner_throwsAccessDenied() throws Exception {
        User owner = new User();
        owner.setId(1L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(accessControl.currentUser()).thenReturn(owner);

        InventoryDTO dto = InventoryDTO.builder().branchId(10L).productId(5L).quantity(10).build();
        assertThrows(AccessDeniedException.class, () -> inventoryService.createInventory(dto));
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void transferInventory_byBranchManager_throwsAccessDenied() throws Exception {
        Branch branch2 = Branch.builder().id(20L).name("Branch 2").store(store).build();
        User manager = new User();
        manager.setId(2L);
        manager.setRole(UserRole.ROLE_BRANCH_MANAGER);

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(branchRepository.findById(20L)).thenReturn(Optional.of(branch2));
        when(accessControl.currentUser()).thenReturn(manager);

        assertThrows(AccessDeniedException.class,
                () -> inventoryService.transferInventory(5L, 10L, 20L, 3));
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void transferInventory_byStoreOwner_transfersBetweenBranchesSuccessfully() throws Exception {
        Branch branch2 = Branch.builder().id(20L).name("Branch 2").store(store).build();
        User owner = new User();
        owner.setId(1L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        Inventory srcInv = Inventory.builder().id(101L).branch(branch).product(product).quantity(10).build();
        Inventory dstInv = Inventory.builder().id(102L).branch(branch2).product(product).quantity(4).build();

        when(branchRepository.findById(10L)).thenReturn(Optional.of(branch));
        when(branchRepository.findById(20L)).thenReturn(Optional.of(branch2));
        when(accessControl.currentUser()).thenReturn(owner);
        when(planLimitChecker.hasFeature(store, PlanFeature.INVENTORY)).thenReturn(true);
        when(inventoryRepository.findAllByProductIdAndBranchIdWithLock(5L, 10L)).thenReturn(List.of(srcInv));
        when(inventoryRepository.findAllByProductIdAndBranchIdWithLock(5L, 20L)).thenReturn(List.of(dstInv));

        inventoryService.transferInventory(5L, 10L, 20L, 3);

        assertEquals(7, srcInv.getQuantity());
        assertEquals(7, dstInv.getQuantity());
        verify(accessControl).assertStoreLevelOrAdmin(owner, store);
        verify(planLimitChecker).requireFeature(store, PlanFeature.MULTI_LOCATION);
        verify(inventoryRepository).save(srcInv);
        verify(inventoryRepository).save(dstInv);
    }
}
