package com.zosh.repository;

import com.zosh.modal.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findByStoreId(Long storeId);
    long countByStoreId(Long storeId);
    List<Branch> findByManagerId(Long managerId);
}
