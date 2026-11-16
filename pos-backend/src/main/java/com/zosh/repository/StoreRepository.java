package com.zosh.repository;

import com.zosh.domain.StoreStatus;
import com.zosh.modal.Store;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface StoreRepository extends JpaRepository<Store,Long> {

    Store findByStoreAdminId(Long adminId);

    Long countByStatus(StoreStatus status);

    List<Store> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    List<Store> findByStatus(StoreStatus status);

    @EntityGraph(attributePaths = {"storeAdmin"})
    @Query("""
            SELECT s FROM Store s
            LEFT JOIN s.storeAdmin a
            WHERE (:status IS NULL OR s.status = :status)
              AND (
                  :keyword IS NULL OR :keyword = ''
                  OR LOWER(s.brand) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(COALESCE(a.fullName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR LOWER(COALESCE(s.contact.email, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                  OR COALESCE(s.contact.phone, '') LIKE CONCAT('%', :keyword, '%')
              )
            """)
    Page<Store> findStoresPaged(
            @Param("status") StoreStatus status,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Query("SELECT COALESCE(AVG(COALESCE(s.commissionRate, 2.5)), 0.0) FROM Store s")
    Double findAverageCommissionRate();

    @Query("SELECT s.id, COALESCE(s.commissionRate, 2.5) FROM Store s")
    List<Object[]> findAllIdAndCommissionRate();
}