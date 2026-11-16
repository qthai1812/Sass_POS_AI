package com.zosh.service;

import com.zosh.modal.User;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.response.PageResponse;

import java.util.List;

public interface ProductService {

    ProductDTO createProduct(ProductDTO productDTO, User user) throws Exception;

    ProductDTO getProductById(Long id) throws Exception;

    ProductDTO updateProduct(Long id, ProductDTO productDTO, User user) throws Exception;

    void deleteProduct(Long id, User user) throws Exception;

    List<ProductDTO> getProductsByStoreId(Long storeId);

    PageResponse<ProductDTO> getProductsByStorePaged(
            Long storeId,
            String keyword,
            Long categoryId,
            int page,
            int size,
            String sortBy,
            String sortDir
    );

    List<ProductDTO> searchByKeyword(Long storeId, String keyword);
}