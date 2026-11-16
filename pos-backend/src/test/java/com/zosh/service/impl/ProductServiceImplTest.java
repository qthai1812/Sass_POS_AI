package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.modal.Category;
import com.zosh.modal.Product;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.response.PageResponse;
import com.zosh.repository.CategoryRepository;
import com.zosh.repository.InventoryRepository;
import com.zosh.repository.OrderItemRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.PlanLimitChecker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductServiceImplTest {

    @Mock private ProductRepository productRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private AccessControlService accessControl;

    @InjectMocks
    private ProductServiceImpl productService;

    private Store store;
    private User owner;
    private Category category;
    private Product product;

    @BeforeEach
    void setUp() {
        store = new Store();
        store.setId(1L);
        store.setBrand("Fashion Co");

        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);
        owner.setStore(store);

        category = Category.builder().id(3L).name("Jackets").store(store).build();
        product = Product.builder()
                .id(55L)
                .name("Denim Jacket")
                .sku("SKU-DJ-01")
                .brand("Levis")
                .sellingPrice(450000.0)
                .mrp(550000.0)
                .category(category)
                .store(store)
                .build();
    }

    @Test
    void getProductsByStorePaged_clampsSizeAndWhitelistsSortField() throws Exception {
        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(accessControl.currentUser()).thenReturn(owner);

        Page<Product> repoPage = new PageImpl<>(List.of(product), PageRequest.of(1, 100), 101);
        when(productRepository.findByStorePaged(eq(1L), eq(3L), eq("Denim"), any(Pageable.class)))
                .thenReturn(repoPage);

        PageResponse<ProductDTO> res = productService.getProductsByStorePaged(
                1L, " Denim ", 3L, -1, 500, "unknownField", "asc"
        );

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(productRepository).findByStorePaged(eq(1L), eq(3L), eq("Denim"), captor.capture());
        assertEquals(0, captor.getValue().getPageNumber());
        assertEquals(100, captor.getValue().getPageSize());
        assertNotNull(captor.getValue().getSort().getOrderFor("createdAt"));

        assertEquals(1, res.getContent().size());
        assertEquals("Denim Jacket", res.getContent().get(0).getName());
        assertEquals(101L, res.getTotalElements());
    }

    @Test
    void getProductsByStorePaged_unauthorizedStore_throwsAccessDenied() throws Exception {
        when(storeRepository.findById(1L)).thenReturn(Optional.of(store));
        when(accessControl.currentUser()).thenReturn(owner);
        doThrow(new AccessDeniedException("Denied")).when(accessControl).assertCanAccessStore(owner, store);

        assertThrows(AccessDeniedException.class, () ->
                productService.getProductsByStorePaged(1L, "", null, 0, 10, "createdAt", "desc")
        );
        verify(productRepository, never()).findByStorePaged(any(), any(), any(), any());
    }
}
