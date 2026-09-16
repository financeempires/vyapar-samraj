package com.vyaparsamraj.service;

import com.vyaparsamraj.entity.Area;
import com.vyaparsamraj.exception.ResourceNotFoundException;
import com.vyaparsamraj.repository.AreaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AreaService {

    private final AreaRepository areaRepository;

    public List<Area> getAreas(UUID userId) {
        return areaRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    @Transactional
    public Area createArea(UUID userId, String name, String section) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Area name is required");
        }
        String cleanSection = "DAILY";
        if (section != null) {
            String upper = section.trim().toUpperCase();
            if (upper.equals("DAILY") || upper.equals("WEEKLY") || upper.equals("MONTHLY")) {
                cleanSection = upper;
            }
        }

        Area area = Area.builder()
                .userId(userId)
                .name(name.trim())
                .section(cleanSection)
                .isMarked(false)
                .build();

        return areaRepository.save(area);
    }

    @Transactional
    public Area updateAreaMarked(UUID userId, UUID areaId, Boolean explicitMarked) {
        Area area = areaRepository.findByIdAndUserId(areaId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Area not found or access denied"));

        if (explicitMarked != null) {
            area.setIsMarked(explicitMarked);
        } else {
            area.setIsMarked(!Boolean.TRUE.equals(area.getIsMarked()));
        }

        return areaRepository.save(area);
    }
}
