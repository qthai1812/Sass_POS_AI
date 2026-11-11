package com.zosh.controller;

import com.zosh.modal.User;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.ProductService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final UserService userService;

    @PreAuthorize("hasRole('STORE_OWNER')")
    @PostMapping
    public ResponseEntity<ProductDTO> create(
            @RequestBody ProductDTO productDTO,
            @RequestHeader("Authorization") String jwt
    ) throws Exception {
        User user = userService.getUserFromJwtToken(jwt);
        return ResponseEntity.ok(productService.createProduct(productDTO, user));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<ProductDTO> getById(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(productService.getProductById(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<ProductDTO>> getByStoreId(
            @PathVariable Long storeId,
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws Exception {
        return ResponseEntity.ok(productService.getProductsByStoreId(storeId));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    public ResponseEntity<ProductDTO> update(
            @PathVariable Long id,
            @RequestBody ProductDTO productDTO,
            @RequestHeader("Authorization") String jwt
    ) throws Exception {
        User user = userService.getUserFromJwtToken(jwt);
        return ResponseEntity.ok(productService.updateProduct(id, productDTO, user));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/store/{storeId}/search")
    public ResponseEntity<List<ProductDTO>> searchByKeyword(
            @PathVariable Long storeId,
            @RequestParam String keyword,
            @RequestHeader(value = "Authorization", required = false) String jwt
    ) throws Exception {
        return ResponseEntity.ok(productService.searchByKeyword(storeId, keyword));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> delete(
            @PathVariable Long id,
            @RequestHeader("Authorization") String jwt
    ) throws Exception {
        User user = userService.getUserFromJwtToken(jwt);
        productService.deleteProduct(id, user);
        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setMessage("Product deleted successfully");
        return ResponseEntity.ok(apiResponse);
    }
}
