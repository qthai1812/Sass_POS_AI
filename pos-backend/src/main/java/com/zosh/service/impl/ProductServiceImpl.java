package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.mapper.ProductMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.PlanLimitChecker;
import com.zosh.service.ProductService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderItemRepository orderItemRepository;
    private final PlanLimitChecker planLimitChecker;
    private final AccessControlService accessControl;

    private void validateStoreAccess(User user, Store store) throws Exception {
        if (user == null || store == null) {
            throw new AccessDeniedException("You do not have permission to manage products in this store");
        }
        if (user.getRole() == UserRole.ROLE_ADMIN) {
            return;
        }
        boolean isStoreOwner = store.getStoreAdmin() != null && store.getStoreAdmin().getId().equals(user.getId());
        boolean isSameStoreEmployee = user.getStore() != null && user.getStore().getId().equals(store.getId());
        boolean hasManagerRole = user.getRole() == UserRole.ROLE_STORE_ADMIN
                || user.getRole() == UserRole.ROLE_STORE_MANAGER;

        if (!hasManagerRole || (!isStoreOwner && !isSameStoreEmployee)) {
            throw new AccessDeniedException("You do not have permission to manage products in this store");
        }
    }

    private void assertCanReadStore(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new EntityNotFoundException("Store not found with id: " + storeId));
        try {
            accessControl.assertCanAccessStore(accessControl.currentUser(), store);
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("You do not have permission to view products of this store");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductDTO createProduct(ProductDTO productDTO, User user) throws Exception {
        Store store = null;
        if (productDTO.getStoreId() != null) {
            store = storeRepository.findById(productDTO.getStoreId()).orElseThrow(
                    () -> new Exception("Store not found")
            );
        } else if (user != null) {
            if (user.getStore() != null) {
                store = user.getStore();
            } else {
                store = storeRepository.findByStoreAdminId(user.getId());
            }
        }
        if (store == null) {
            throw new Exception("Store not found");
        }
        validateStoreAccess(user, store);
        planLimitChecker.checkProductLimit(store);

        if (productDTO.getSellingPrice() != null && productDTO.getSellingPrice() < 0) {
            throw new IllegalArgumentException("Selling price cannot be negative");
        }
        if (productDTO.getMrp() != null && productDTO.getMrp() < 0) {
            throw new IllegalArgumentException("MRP cannot be negative");
        }
        if (productDTO.getSku() != null && !productDTO.getSku().trim().isEmpty()) {
            String cleanSku = productDTO.getSku().trim();
            if (productRepository.existsByStoreIdAndSkuIgnoreCase(store.getId(), cleanSku)) {
                throw new IllegalArgumentException("Mã SKU '" + cleanSku + "' đã tồn tại trong cửa hàng này");
            }
            productDTO.setSku(cleanSku);
        }

        Category category = null;
        if (productDTO.getCategoryId() != null) {
            category = categoryRepository.findById(productDTO.getCategoryId()).orElseThrow(
                    () -> new Exception("Category not found")
            );
            if (category.getStore() != null && !category.getStore().getId().equals(store.getId())) {
                throw new Exception("Category does not belong to this store");
            }
        }

        Product product = ProductMapper.toEntity(productDTO, store, category);
        Product savedProduct = productRepository.save(product);
        return ProductMapper.toDTO(savedProduct);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDTO getProductById(Long id) throws Exception {
        Product product = productRepository.findById(id).orElseThrow(
                () -> new Exception("Product not found with id: " + id)
        );
        accessControl.assertCanAccessStore(accessControl.currentUser(), product.getStore());
        return ProductMapper.toDTO(product);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductDTO updateProduct(Long id, ProductDTO productDTO, User user) throws Exception {
        Product product = productRepository.findById(id).orElseThrow(
                () -> new Exception("product not found")
        );
        validateStoreAccess(user, product.getStore());

        if (productDTO.getSellingPrice() != null && productDTO.getSellingPrice() < 0) {
            throw new IllegalArgumentException("Selling price cannot be negative");
        }
        if (productDTO.getMrp() != null && productDTO.getMrp() < 0) {
            throw new IllegalArgumentException("MRP cannot be negative");
        }
        if (productDTO.getSku() != null && !productDTO.getSku().trim().isEmpty()) {
            String cleanSku = productDTO.getSku().trim();
            if (product.getStore() != null
                    && productRepository.existsByStoreIdAndSkuIgnoreCaseAndIdNot(product.getStore().getId(), cleanSku, id)) {
                throw new IllegalArgumentException("Mã SKU '" + cleanSku + "' đã tồn tại trong cửa hàng này");
            }
            product.setSku(cleanSku);
        }
        if (productDTO.getName() != null && !productDTO.getName().trim().isEmpty()) {
            product.setName(productDTO.getName().trim());
        }
        if (productDTO.getDescription() != null) {
            product.setDescription(productDTO.getDescription().trim());
        }
        if (productDTO.getImage() != null) {
            product.setImage(productDTO.getImage());
        }
        if (productDTO.getMrp() != null) {
            product.setMrp(productDTO.getMrp());
        }
        if (productDTO.getSellingPrice() != null) {
            product.setSellingPrice(productDTO.getSellingPrice());
        }
        if (productDTO.getBrand() != null) {
            product.setBrand(productDTO.getBrand());
        }
        if (productDTO.getColor() != null) {
            product.setColor(productDTO.getColor());
        }
        product.setUpdatedAt(LocalDateTime.now());

        if (productDTO.getCategoryId() != null) {
            Category category = categoryRepository.findById(productDTO.getCategoryId()).orElseThrow(
                    () -> new Exception("category not found")
            );
            if (category.getStore() != null && product.getStore() != null
                    && !category.getStore().getId().equals(product.getStore().getId())) {
                throw new Exception("Category does not belong to this store");
            }
            product.setCategory(category);
        }

        Product savedProduct = productRepository.save(product);
        return ProductMapper.toDTO(savedProduct);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProduct(Long id, User user) throws Exception {
        Product product = productRepository.findById(id).orElseThrow(
                () -> new Exception("product not found")
        );
        validateStoreAccess(user, product.getStore());

        List<Inventory> inventories = inventoryRepository.findByProductId(id);
        if (!inventories.isEmpty()) {
            inventoryRepository.deleteAll(inventories);
        }

        orderItemRepository.unlinkProductFromOrderItems(id);

        productRepository.delete(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDTO> getProductsByStoreId(Long storeId) {
        assertCanReadStore(storeId);
        List<Product> products = productRepository.findByStoreId(storeId);
        return products.stream()
                .map(ProductMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDTO> searchByKeyword(Long storeId, String keyword) {
        assertCanReadStore(storeId);
        List<Product> products = productRepository.searchByKeyword(storeId, keyword);
        return products.stream()
                .map(ProductMapper::toDTO)
                .collect(Collectors.toList());
    }
}
