package com.zosh.repository;

import com.zosh.modal.Refund;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface RefundRepository extends JpaRepository<Refund, Long> {

    boolean existsByOrderId(Long orderId);

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByOrderId(Long orderId);

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByCashierIdAndCreatedAtBetween(
            Long cashier,
            LocalDateTime from,
            LocalDateTime to
    );

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByCashierId(Long id);

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByShiftReportId(Long id);

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByBranchId(Long id);

    @EntityGraph(attributePaths = {"order", "cashier", "branch", "branch.store", "shiftReport", "items"})
    List<Refund> findByBranchStoreId(Long storeId);

    @Query("""
            SELECT r.order.branch.store.id, COALESCE(SUM(r.amount), 0.0)
            FROM Refund r
            WHERE r.order IS NOT NULL
              AND r.order.branch.store.id IS NOT NULL
              AND (r.order.status IS NULL
                   OR r.order.status = com.zosh.domain.OrderStatus.COMPLETED
                   OR r.order.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            GROUP BY r.order.branch.store.id
            """)
    List<Object[]> sumRefundsOnCompletedOrdersGroupedByStore();

    @Query("""
            SELECT COALESCE(SUM(r.amount), 0.0)
            FROM Refund r
            WHERE r.order IS NOT NULL
              AND r.order.branch.store.id = :storeId
              AND (r.order.status IS NULL
                   OR r.order.status = com.zosh.domain.OrderStatus.COMPLETED
                   OR r.order.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            """)
    Double sumRefundsOnCompletedOrdersByStoreId(@Param("storeId") Long storeId);

    @Query("""
            SELECT COALESCE(SUM(r.amount), 0.0)
            FROM Refund r
            WHERE r.order IS NOT NULL
              AND r.order.branch.id = :branchId
              AND (r.order.status IS NULL
                   OR r.order.status = com.zosh.domain.OrderStatus.COMPLETED
                   OR r.order.status = com.zosh.domain.OrderStatus.PARTIALLY_REFUNDED)
            """)
    Double sumRefundsOnCompletedOrdersByBranchId(@Param("branchId") Long branchId);
}
