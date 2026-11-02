package com.zosh.repository;

import com.zosh.modal.Customer;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByFullNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
            String fullName, String email);

    @Query("SELECT c FROM Customer c WHERE c.store.id = :storeId")
    List<Customer> findByStoreId(@Param("storeId") Long storeId);

    @Query("SELECT c FROM Customer c WHERE " +
            "LOWER(c.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(c.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "c.phone LIKE CONCAT('%', :keyword, '%')")
    List<Customer> searchCustomers(@Param("keyword") String keyword);

    @Query("SELECT c FROM Customer c WHERE c.store.id = :storeId AND (" +
            "LOWER(c.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(c.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "c.phone LIKE CONCAT('%', :keyword, '%'))")
    List<Customer> searchCustomersByStore(@Param("storeId") Long storeId, @Param("keyword") String keyword);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Customer c WHERE c.id = :id")
    Optional<Customer> findByIdWithLock(@Param("id") Long id);

    @Query("SELECT COUNT(c) > 0 FROM Customer c WHERE c.store.id = :storeId AND c.phone = :phone AND c.id != :id")
    boolean existsByStoreIdAndPhoneAndIdNot(@Param("storeId") Long storeId, @Param("phone") String phone, @Param("id") Long id);

    @Query("SELECT COUNT(c) > 0 FROM Customer c WHERE c.store.id = :storeId AND c.phone = :phone")
    boolean existsByStoreIdAndPhone(@Param("storeId") Long storeId, @Param("phone") String phone);
}
