package com.zosh.repository;

import com.zosh.modal.Store;
import com.zosh.modal.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    User findByEmail(String email);

    List<User> findByStore(Store store);
    long countByStore(Store store);
    long countByStoreId(Long storeId);

    List<User> findByBranchId(Long branchId);
    long countByBranchId(Long branchId);
}
