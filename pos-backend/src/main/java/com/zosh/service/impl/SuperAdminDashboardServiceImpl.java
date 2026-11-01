package com.zosh.service.impl;

import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.response.DashboardSummaryDTO;
import com.zosh.payload.response.StoreRegistrationStatDTO;
import com.zosh.payload.response.StoreStatusDistributionDTO;
import com.zosh.repository.StoreRepository;
import com.zosh.service.SuperAdminDashboardService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SuperAdminDashboardServiceImpl implements SuperAdminDashboardService {

    private final StoreRepository storeRepository;
    private final UserService userService;

    private void assertSuperAdmin() {
        try {
            User current = userService.getCurrentUser();
            if (current == null || current.getRole() != UserRole.ROLE_ADMIN) {
                throw new AccessDeniedException("Super Admin privilege is required");
            }
        } catch (AccessDeniedException ade) {
            throw ade;
        } catch (Exception e) {
            throw new AccessDeniedException("Super Admin privilege is required");
        }
    }

    @Override
    public DashboardSummaryDTO getDashboardSummary() {
        assertSuperAdmin();
        long total = storeRepository.count();
        long active = storeRepository.countByStatus(StoreStatus.ACTIVE);
        long pending = storeRepository.countByStatus(StoreStatus.PENDING);
        long blocked = storeRepository.countByStatus(StoreStatus.BLOCKED);

        return DashboardSummaryDTO.builder()
                .totalStores(total)
                .activeStores(active)
                .pendingStores(pending)
                .blockedStores(blocked)
                .build();
    }

    @Override
    public List<StoreRegistrationStatDTO> getStoreRegistrationStats() {
        assertSuperAdmin();
        LocalDate today = LocalDate.now();
        LocalDate sevenDaysAgo = today.minusDays(6);

        LocalDateTime start = sevenDaysAgo.atStartOfDay();
        LocalDateTime end = today.atTime(LocalTime.MAX);

        List<Store> recentStores = storeRepository.findByCreatedAtBetween(start, end);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Long> countByDate = recentStores.stream()
                .filter(s -> s.getCreatedAt() != null)
                .collect(Collectors.groupingBy(
                        s -> s.getCreatedAt().toLocalDate().format(formatter),
                        Collectors.counting()
                ));

        List<StoreRegistrationStatDTO> result = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate date = sevenDaysAgo.plusDays(i);
            String dateStr = date.format(formatter);
            long count = countByDate.getOrDefault(dateStr, 0L);
            result.add(StoreRegistrationStatDTO.builder()
                    .date(dateStr)
                    .count(count)
                    .build());
        }

        return result;
    }

    @Override
    public StoreStatusDistributionDTO getStoreStatusDistribution() {
        assertSuperAdmin();
        long active = storeRepository.countByStatus(StoreStatus.ACTIVE);
        long pending = storeRepository.countByStatus(StoreStatus.PENDING);
        long blocked = storeRepository.countByStatus(StoreStatus.BLOCKED);

        return StoreStatusDistributionDTO.builder()
                .active(active)
                .pending(pending)
                .blocked(blocked)
                .build();
    }
}
