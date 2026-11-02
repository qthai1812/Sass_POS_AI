package com.zosh.repository;

import com.zosh.modal.Order;
import com.zosh.modal.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByCustomerId(Long customerId);

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByBranchId(Long branchId);

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByCashierId(Long cashierId);

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByBranchIdAndCreatedAtBetween(
            Long branchId,
            LocalDateTime from,
            LocalDateTime to
    );

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByBranchIdAndCashierIdAndCreatedAtBetween(
            Long branchId,
            Long cashierId,
            LocalDateTime from,
            LocalDateTime to
    );

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByCashierAndCreatedAtBetween(
            User cashier,
            LocalDateTime from,
            LocalDateTime to
    );

    @EntityGraph(attributePaths = {"cashier", "customer", "branch"})
    List<Order> findTop5ByBranchIdOrderByCreatedAtDesc(Long branchId);

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    @Query("SELECT o FROM Order o WHERE o.branch.store.id = :storeId")
    List<Order> findAllByStoreIdWithDetails(@Param("storeId") Long storeId);

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    @Query("SELECT o FROM Order o WHERE o.branch.store.id = :storeId AND o.createdAt BETWEEN :from AND :to")
    List<Order> findByStoreIdAndCreatedAtBetween(
            @Param("storeId") Long storeId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("""
            SELECT COALESCE(SUM(o.totalAmount), 0.0) - (
                SELECT COALESCE(SUM(r.amount), 0.0)
                FROM Refund r
                WHERE r.order IS NOT NULL
                  AND r.order.branch.store.id = :storeId
                  AND (r.order.status IS NULL OR r.order.status = com.zosh.domain.OrderStatus.COMPLETED)
            )
            FROM Order o
            WHERE o.branch.store.id = :storeId
              AND (o.status IS NULL OR o.status = com.zosh.domain.OrderStatus.COMPLETED)
            """)
    Double sumCompletedSalesByStoreId(@Param("storeId") Long storeId);

    @Query("SELECT o.branch.store.id, COALESCE(SUM(o.totalAmount), 0.0) FROM Order o WHERE o.branch.store.id IS NOT NULL AND (o.status IS NULL OR o.status = com.zosh.domain.OrderStatus.COMPLETED) GROUP BY o.branch.store.id")
    List<Object[]> sumCompletedSalesGroupedByStore();
}
