package com.zosh.repository;

import com.zosh.modal.Inventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    /**
     * Trả về TẤT CẢ row trùng lặp — dùng để detect và merge duplicate cũ.
     */
    List<Inventory> findAllByProductIdAndBranchId(Long productId, Long branchId);

    /**
     * An toàn kể cả khi DB đang có duplicate: chỉ lấy 1 row đầu tiên.
     * Dùng cho các query read-only không cần lock.
     */
    Optional<Inventory> findFirstByProductIdAndBranchId(Long productId, Long branchId);

    List<Inventory> findByBranchId(Long branchId);

    List<Inventory> findByProductId(Long productId);

    @EntityGraph(attributePaths = {"branch", "product", "product.category", "product.store"})
    @Query("""
            SELECT i FROM Inventory i
            JOIN i.product p
            LEFT JOIN p.category c
            WHERE i.branch.id = :branchId
              AND (:category IS NULL OR :category = '' OR LOWER(COALESCE(c.name, 'Chưa phân loại')) = LOWER(:category))
              AND (
                  :keyword IS NULL OR :keyword = ''
                  OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(COALESCE(p.sku, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            """)
    Page<Inventory> findByBranchPaged(
            @Param("branchId") Long branchId,
            @Param("keyword") String keyword,
            @Param("category") String category,
            Pageable pageable
    );

    @Query("""
            SELECT COUNT(i),
                   COALESCE(SUM(i.quantity), 0),
                   COALESCE(SUM(CASE WHEN i.quantity > 0 AND i.quantity <= COALESCE(i.minStockLevel, 10) THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN i.quantity <= 0 THEN 1 ELSE 0 END), 0)
            FROM Inventory i
            JOIN i.product p
            LEFT JOIN p.category c
            WHERE i.branch.id = :branchId
              AND (:category IS NULL OR :category = '' OR LOWER(COALESCE(c.name, 'Chưa phân loại')) = LOWER(:category))
              AND (
                  :keyword IS NULL OR :keyword = ''
                  OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(COALESCE(p.sku, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            """)
    List<Object[]> summarizeBranchInventory(
            @Param("branchId") Long branchId,
            @Param("keyword") String keyword,
            @Param("category") String category
    );

    /**
     * Pessimistic write lock (SELECT ... FOR UPDATE) — chống race condition.
     * Trả về 1 row duy nhất (sau khi đã dedup).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.product.id = :productId AND i.branch.id = :branchId ORDER BY i.id ASC")
    List<Inventory> findAllByProductIdAndBranchIdWithLock(
            @Param("productId") Long productId,
            @Param("branchId") Long branchId
    );

    /**
     * Xóa các row duplicate, chỉ giữ lại 1 row có id nhỏ nhất.
     */
    @Modifying
    @Query("DELETE FROM Inventory i WHERE i.product.id = :productId AND i.branch.id = :branchId AND i.id <> :keepId")
    void deleteDuplicates(
            @Param("productId") Long productId,
            @Param("branchId") Long branchId,
            @Param("keepId") Long keepId
    );
}
