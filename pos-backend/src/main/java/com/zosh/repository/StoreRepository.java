package com.zosh.repository;

import com.zosh.domain.StoreStatus;
import com.zosh.modal.Store;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface StoreRepository extends JpaRepository<Store,Long> {

    Store findByStoreAdminId(Long adminId);

    Long countByStatus(StoreStatus status);

    List<Store> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    List<Store> findByStatus(StoreStatus status);
}