package com.zosh.repository;

import com.zosh.domain.BranchTransferRequestStatus;
import com.zosh.modal.BranchTransferRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BranchTransferRequestRepository extends JpaRepository<BranchTransferRequest, Long> {

    List<BranchTransferRequest> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<BranchTransferRequest> findByStoreIdOrderByCreatedAtDesc(Long storeId);

    @EntityGraph(attributePaths = {"employee", "store", "fromBranch", "toBranch", "reviewedBy"})
    @Query("""
            SELECT r FROM BranchTransferRequest r
            WHERE r.store.id = :storeId
              AND (:status IS NULL OR r.status = :status)
            """)
    Page<BranchTransferRequest> findByStoreIdPaged(
            @Param("storeId") Long storeId,
            @Param("status") BranchTransferRequestStatus status,
            Pageable pageable
    );

    long countByStoreId(Long storeId);

    long countByStoreIdAndStatus(Long storeId, BranchTransferRequestStatus status);

    boolean existsByEmployeeIdAndStatus(Long employeeId, BranchTransferRequestStatus status);

    @Modifying
    @Query("DELETE FROM BranchTransferRequest r WHERE r.employee.id = :employeeId")
    void deleteByEmployeeId(@Param("employeeId") Long employeeId);

    @Modifying
    @Query("DELETE FROM BranchTransferRequest r WHERE r.fromBranch.id = :branchId OR r.toBranch.id = :branchId")
    void deleteByBranchId(@Param("branchId") Long branchId);

    @Modifying
    @Query("DELETE FROM BranchTransferRequest r WHERE r.store.id = :storeId")
    void deleteByStoreId(@Param("storeId") Long storeId);
}

