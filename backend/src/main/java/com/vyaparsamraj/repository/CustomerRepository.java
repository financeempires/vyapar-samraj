package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByUserIdAndSerialNumber(UUID userId, Integer serialNumber);

    Optional<Customer> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT c FROM Customer c WHERE c.userId = :userId AND c.areaId = :areaId ORDER BY CASE WHEN c.serialNumber IS NULL THEN 1 ELSE 0 END, c.serialNumber ASC, c.createdAt ASC")
    List<Customer> findByUserIdAndAreaId(@Param("userId") UUID userId, @Param("areaId") UUID areaId);

    @Query("SELECT c FROM Customer c WHERE c.userId = :userId AND c.areaId = :areaId AND LOWER(c.section) = LOWER(:section) ORDER BY CASE WHEN c.serialNumber IS NULL THEN 1 ELSE 0 END, c.serialNumber ASC, c.createdAt ASC")
    List<Customer> findByUserIdAndAreaIdAndSection(@Param("userId") UUID userId, @Param("areaId") UUID areaId, @Param("section") String section);
}
