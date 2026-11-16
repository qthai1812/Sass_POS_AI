package com.zosh.repository;

import com.zosh.domain.SubscriptionStatus;
import com.zosh.modal.Subscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findByStoreId(Long storeId);
    List<Subscription> findByStoreIdAndStatus(Long storeId, SubscriptionStatus status);
    List<Subscription> findByStoreIdAndStatusIn(Long storeId, Collection<SubscriptionStatus> statuses);
    List<Subscription> findByStatus(SubscriptionStatus status);
    List<Subscription> findByStatusIn(Collection<SubscriptionStatus> statuses);
    List<Subscription> findByEndDateBeforeAndStatus(LocalDateTime date, SubscriptionStatus status);
    List<Subscription> findByEndDateBeforeAndStatusIn(LocalDateTime date, Collection<SubscriptionStatus> statuses);
    boolean existsByTransactionId(String transactionId);
    long countByStatus(SubscriptionStatus status);
    boolean existsByPlanIdAndStatusIn(String planId, Collection<SubscriptionStatus> statuses);

    @EntityGraph(attributePaths = {"store"})
    @Query("SELECT s FROM Subscription s WHERE (:status IS NULL OR s.status = :status)")
    Page<Subscription> findAdminByStatusPaged(@Param("status") SubscriptionStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"store"})
    @Query("SELECT s FROM Subscription s WHERE s.endDate <= :cutoff AND s.status IN :statuses")
    Page<Subscription> findAdminExpiringPaged(
            @Param("cutoff") LocalDateTime cutoff,
            @Param("statuses") Collection<SubscriptionStatus> statuses,
            Pageable pageable
    );
}
