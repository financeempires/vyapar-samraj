package com.vyaparsamraj.repository;

import com.vyaparsamraj.entity.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AreaRepository extends JpaRepository<Area, UUID> {

    List<Area> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<Area> findByIdAndUserId(UUID id, UUID userId);
}
