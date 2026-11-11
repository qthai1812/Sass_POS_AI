package com.zosh.service.impl;

import com.zosh.domain.UserRole;
import com.zosh.mapper.CategoryMapper;
import com.zosh.modal.Category;
import com.zosh.modal.Product;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.CategoryDTO;
import com.zosh.repository.CategoryRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.CategoryService;
import com.zosh.service.UserService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserService userService;
    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final AccessControlService accessControl;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CategoryDTO createCategory(CategoryDTO dto) throws Exception {
        User user = userService.getCurrentUser();

        Store store = null;
        if (dto.getStoreId() != null) {
            store = storeRepository.findById(dto.getStoreId()).orElseThrow(
                    () -> new Exception("Store not found")
            );
        } else if (user.getStore() != null) {
            store = user.getStore();
        } else {
            store = storeRepository.findByStoreAdminId(user.getId());
        }

        if (store == null) {
            throw new Exception("Store not found");
        }

        Category category = Category.builder()
                .store(store)
                .name(dto.getName())
                .description(dto.getDescription())
                .build();
        checkAuthority(user, category.getStore());
        return CategoryMapper.toDTO(categoryRepository.save(category));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryDTO> getCategoriesByStore(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new EntityNotFoundException("Store not found with id: " + storeId));
        try {
            accessControl.assertCanAccessStore(userService.getCurrentUser(), store);
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("You do not have permission to view categories of this store");
        }
        List<Category> categories = categoryRepository.findByStoreId(storeId);
        return categories.stream().map(
                CategoryMapper::toDTO
        ).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CategoryDTO updateCategory(Long id, CategoryDTO dto) throws Exception {
        Category category = categoryRepository.findById(id).orElseThrow(
                () -> new Exception("category not exist")
        );
        User user = userService.getCurrentUser();
        checkAuthority(user, category.getStore());
        if (dto.getName() != null) {
            category.setName(dto.getName());
        }
        if (dto.getDescription() != null) {
            category.setDescription(dto.getDescription());
        }
        return CategoryMapper.toDTO(categoryRepository.save(category));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteCategory(Long id) throws Exception {
        Category category = categoryRepository.findById(id).orElseThrow(
                () -> new Exception("category not exist")
        );
        User user = userService.getCurrentUser();
        checkAuthority(user, category.getStore());

        List<Product> products = productRepository.findByCategoryId(category.getId());
        for (Product product : products) {
            product.setCategory(null);
            productRepository.save(product);
        }

        categoryRepository.delete(category);
    }

    private void checkAuthority(User user, Store store) throws Exception {
        if (user == null || store == null) {
            throw new AccessDeniedException("you don't have permission to manage this category");
        }
        boolean isStoreOwner = user.getRole() == UserRole.ROLE_STORE_OWNER
                && store.getStoreAdmin() != null
                && store.getStoreAdmin().getId().equals(user.getId());
        boolean isSameStoreOwner = user.getRole() == UserRole.ROLE_STORE_OWNER
                && user.getStore() != null
                && user.getStore().getId().equals(store.getId());

        if (!isStoreOwner && !isSameStoreOwner) {
            throw new AccessDeniedException("you don't have permission to manage this category");
        }
    }
}
