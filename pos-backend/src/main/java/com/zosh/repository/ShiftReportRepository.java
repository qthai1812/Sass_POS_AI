package com.zosh.repository;

import com.zosh.modal.ShiftReport;
import com.zosh.modal.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ShiftReportRepository extends JpaRepository<ShiftReport, Long> {

    @Override
    @EntityGraph(attributePaths = {"cashier", "branch", "branch.store"})
    List<ShiftReport> findAll();

    @EntityGraph(attributePaths = {"cashier", "branch", "branch.store"})
    List<ShiftReport> findByCashierId(Long id);

    @EntityGraph(attributePaths = {"cashier", "branch", "branch.store"})
    List<ShiftReport> findByBranchId(Long id);

    @EntityGraph(attributePaths = {"cashier", "branch", "branch.store"})
    List<ShiftReport> findByBranchStoreId(Long storeId);

    Optional<ShiftReport> findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(User cashier);

    Optional<ShiftReport> findTopByCashierAndShiftStartBetweenOrderByShiftStartDesc(
            User cashier,
            LocalDateTime start,
            LocalDateTime end
    );

    @Query(
            value = "SELECT s.id FROM ShiftReport s WHERE s.cashier.id = :cashierId",
            countQuery = "SELECT COUNT(s.id) FROM ShiftReport s WHERE s.cashier.id = :cashierId"
    )
    Page<Long> findShiftIdsByCashierPaged(@Param("cashierId") Long cashierId, Pageable pageable);

    @Query(
            value = "SELECT s.id FROM ShiftReport s WHERE s.branch.id = :branchId",
            countQuery = "SELECT COUNT(s.id) FROM ShiftReport s WHERE s.branch.id = :branchId"
    )
    Page<Long> findShiftIdsByBranchPaged(@Param("branchId") Long branchId, Pageable pageable);

    @Query(
            value = "SELECT s.id FROM ShiftReport s WHERE s.branch.id = :branchId AND s.cashier.id = :cashierId",
            countQuery = "SELECT COUNT(s.id) FROM ShiftReport s WHERE s.branch.id = :branchId AND s.cashier.id = :cashierId"
    )
    Page<Long> findShiftIdsByBranchAndCashierPaged(
            @Param("branchId") Long branchId,
            @Param("cashierId") Long cashierId,
            Pageable pageable
    );

    @Query(
            value = "SELECT s.id FROM ShiftReport s WHERE s.branch.store.id = :storeId",
            countQuery = "SELECT COUNT(s.id) FROM ShiftReport s WHERE s.branch.store.id = :storeId"
    )
    Page<Long> findShiftIdsByStorePaged(@Param("storeId") Long storeId, Pageable pageable);

    @EntityGraph(attributePaths = {"cashier", "branch", "branch.store", "refunds"})
    @Query("SELECT DISTINCT s FROM ShiftReport s WHERE s.id IN :ids")
    List<ShiftReport> findAllWithDetailsByIdIn(@Param("ids") List<Long> ids);
}
