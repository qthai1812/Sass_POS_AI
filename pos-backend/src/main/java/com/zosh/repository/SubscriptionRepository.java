package com.zosh.repository;

import com.zosh.domain.SubscriptionStatus;
import com.zosh.modal.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
