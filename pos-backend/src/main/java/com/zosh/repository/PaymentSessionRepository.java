package com.zosh.repository;

import com.zosh.modal.PaymentSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentSessionRepository extends JpaRepository<PaymentSession, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PaymentSession p WHERE p.sessionId = :sessionId")
    Optional<PaymentSession> findByIdWithLock(@Param("sessionId") String sessionId);

    boolean existsByProviderTxId(String providerTxId);

    List<PaymentSession> findByStoreId(Long storeId);

    void deleteByStoreId(Long storeId);

    List<PaymentSession> findByStatusOrderByCreatedAtDesc(String status);

    Optional<PaymentSession> findTopByOrderIdOrderByCreatedAtDesc(Long orderId);

    Optional<PaymentSession> findTopBySubscriptionIdOrderByCreatedAtDesc(Long subscriptionId);
}
