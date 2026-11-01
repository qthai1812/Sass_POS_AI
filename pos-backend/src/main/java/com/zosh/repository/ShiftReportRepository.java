package com.zosh.repository;

import com.zosh.modal.ShiftReport;
import com.zosh.modal.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
