package com.zosh.repository;

import com.zosh.domain.OrderStatus;
import com.zosh.modal.Order;
import com.zosh.modal.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findByIdWithLock(@Param("id") Long id);

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
    @Query("""
            SELECT o FROM Order o
            WHERE o.branch.id = :branchId
              AND o.cashier.id = :cashierId
              AND COALESCE(o.paidAt, o.createdAt) BETWEEN :from AND :to
            """)
    List<Order> findShiftOrdersByBranchAndCashierBetween(
            @Param("branchId") Long branchId,
            @Param("cashierId") Long cashierId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    List<Order> findByCashierAndCreatedAtBetween(
            User cashier,
            LocalDateTime from,
            LocalDateTime to
    );

    @EntityGraph(attributePaths = {"items", "items.product", "items.product.category", "cashier", "customer", "branch"})
    @Query("""
            SELECT o FROM Order o
            WHERE o.cashier = :cashier
              AND COALESCE(o.paidAt, o.createdAt) BETWEEN :from AND :to
            """)
    List<Order> findShiftOrdersByCashierBetween(
            @Param("cashier") User cashier,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @EntityGraph(attributePaths = {"cashier", "customer", "branch"})
    List<Order> findTop5ByBranchIdOrderByCreatedAtDesc(Long branchId);

    @EntityGraph(attributePaths = {"items", "items.product", "cashier", "customer", "branch"})
    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, LocalDateTime cutoff);

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
                  AND (r.order.status IS NULL
                       OR r.order.status = com.zosh.domain.OrderStatus.COMPLETED
                       OR r.order.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            )
            FROM Order o
            WHERE o.branch.store.id = :storeId
              AND (o.status IS NULL
                   OR o.status = com.zosh.domain.OrderStatus.COMPLETED
                   OR o.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            """)
    Double sumCompletedSalesByStoreId(@Param("storeId") Long storeId);

    @Query("""
            SELECT o.branch.store.id, COALESCE(SUM(o.totalAmount), 0.0)
            FROM Order o
            WHERE o.branch.store.id IS NOT NULL
              AND (o.status IS NULL
                   OR o.status = com.zosh.domain.OrderStatus.COMPLETED
                   OR o.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            GROUP BY o.branch.store.id
            """)
    List<Object[]> sumCompletedSalesGroupedByStore();
}
