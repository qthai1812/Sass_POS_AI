package com.zosh.repository;

import com.zosh.modal.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByStoreId(Long storeId);

    long countByStoreId(Long storeId);

    List<Product> findByCategoryId(Long categoryId);

    @Query(
            "SELECT p FROM Product p " +
                    "WHERE p.store.id = :storeId AND ( " +
                    "LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(p.brand) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :query, '%'))" +
                    ")"
    )
    List<Product> searchByKeyword(@Param("storeId") Long storeId,
                                  @Param("query") String keyword);

    @Query("SELECT COUNT(p) > 0 FROM Product p WHERE p.store.id = :storeId AND LOWER(p.sku) = LOWER(:sku)")
    boolean existsByStoreIdAndSkuIgnoreCase(@Param("storeId") Long storeId, @Param("sku") String sku);

    @Query("SELECT COUNT(p) > 0 FROM Product p WHERE p.store.id = :storeId AND LOWER(p.sku) = LOWER(:sku) AND p.id != :id")
    boolean existsByStoreIdAndSkuIgnoreCaseAndIdNot(@Param("storeId") Long storeId, @Param("sku") String sku, @Param("id") Long id);
}
