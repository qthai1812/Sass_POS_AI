package com.zosh.service.impl;

import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.mapper.RefundMapper;
import com.zosh.mapper.ShiftReportMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.ShiftReportService;
import com.zosh.service.UserService;
import com.zosh.service.shift.ShiftMetricsCalculator;
import com.zosh.service.shift.ShiftMetricsCalculator.ShiftMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftReportServiceImpl implements ShiftReportService {

    private final ShiftReportRepository shiftReportRepository;
    private final UserService userService;
    private final BranchRepository branchRepository;
    private final RefundRepository refundRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControl;
    private final ShiftMetricsCalculator metricsCalculator;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO startShift(Long branchId) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_CASHIER) {
            throw new AccessDeniedException("Chỉ Thu ngân (ROLE_CASHIER) mới được phép mở ca làm việc tại quầy.");
        }

        Optional<ShiftReport> activeShift = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(currentUser);
        if (activeShift.isPresent()) {
            return getCurrentShiftProgress(currentUser.getId());
        }

        Branch branch = resolveBranchForShiftStart(currentUser, branchId);
        assertStoreOperationalForShift(branch);

        ShiftReport shiftReport = ShiftReport.builder()
                .cashier(currentUser)
                .shiftStart(LocalDateTime.now())
                .branch(branch)
                .totalSales(0.0)
                .totalRefunds(0.0)
                .netSale(0.0)
                .totalOrders(0)
                .build();

        ShiftReport savedReport = shiftReportRepository.save(shiftReport);
        return ShiftReportMapper.toDTO(savedReport);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftReportDTO getShiftReportById(Long id) throws Exception {
        ShiftReport report = shiftReportRepository.findById(id)
                .orElseThrow(() -> new Exception("shift report not found with given id " + id));
        assertCanViewShift(userService.getCurrentUser(), report);
        return buildPopulatedDTO(report);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getAllShiftReports() {
        User current = resolveCurrentUserOrThrowAccessDenied();
        if (current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin không truy cập báo cáo ca làm việc nội bộ của cửa hàng.");
        }
        List<ShiftReport> reports = fetchReportsByRole(current);
        return mapVisibleReports(current, reports);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getShiftReportsByBranchId(Long branchId) {
        User current = resolveCurrentUserOrThrowAccessDenied();
        return mapVisibleReports(current, shiftReportRepository.findByBranchId(branchId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getShiftReportsByCashierId(Long cashierId) {
        User current = resolveCurrentUserOrThrowAccessDenied();
        return mapVisibleReports(current, shiftReportRepository.findByCashierId(cashierId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO endShift(Long shiftReportId, LocalDateTime shiftEnd) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_CASHIER) {
            throw new AccessDeniedException("Chỉ Thu ngân (ROLE_CASHIER) mới có quyền kết thúc ca làm việc qua API này.");
        }

        ShiftReport shiftReport;
        if (shiftReportId != null) {
            shiftReport = shiftReportRepository.findById(shiftReportId)
                    .orElseThrow(() -> new Exception("Shift not found with id: " + shiftReportId));
            if (shiftReport.getCashier() == null || !shiftReport.getCashier().getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("Thu ngân chỉ có thể kết thúc ca làm việc của chính mình.");
            }
        } else {
            shiftReport = shiftReportRepository
                    .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(currentUser)
                    .orElseThrow(() -> new Exception("Shift not found"));
        }

        return finalizeShiftClose(shiftReport, shiftEnd);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO closeShiftInternal(Long shiftReportId, LocalDateTime shiftEnd) throws Exception {
        if (shiftReportId == null) {
            throw new IllegalArgumentException("shiftReportId is required for internal shift closure");
        }
        ShiftReport shiftReport = shiftReportRepository.findById(shiftReportId)
                .orElseThrow(() -> new Exception("Shift not found with id: " + shiftReportId));
        return finalizeShiftClose(shiftReport, shiftEnd);
    }

    private ShiftReportDTO finalizeShiftClose(ShiftReport shiftReport, LocalDateTime shiftEnd) {
        if (shiftReport.getShiftEnd() != null) {
            return buildPopulatedDTO(shiftReport);
        }

        LocalDateTime actualEnd = shiftEnd != null ? shiftEnd : LocalDateTime.now();
        shiftReport.setShiftEnd(actualEnd);

        List<Refund> refunds = fetchShiftRefunds(shiftReport);
        List<Order> orders = fetchShiftOrders(shiftReport, actualEnd);
        ShiftMetrics metrics = metricsCalculator.calculateAndAttach(shiftReport, orders, refunds);

        shiftReport.setTotalRefunds(metrics.totalRefunds());
        shiftReport.setTotalSales(metrics.totalSales());
        shiftReport.setTotalOrders(metrics.totalOrders());
        shiftReport.setNetSale(metrics.netSales());

        ShiftReport savedReport = shiftReportRepository.save(shiftReport);
        if (savedReport != shiftReport) {
            savedReport.setRecentOrders(shiftReport.getRecentOrders());
            savedReport.setTopSellingProducts(shiftReport.getTopSellingProducts());
            savedReport.setPaymentSummaries(shiftReport.getPaymentSummaries());
        }
        ShiftReportDTO dto = ShiftReportMapper.toDTO(savedReport);
        dto.setRefunds(refunds.stream().map(RefundMapper::toDTO).collect(Collectors.toList()));
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftReportDTO getCurrentShiftProgress(Long cashierId) throws Exception {
        User targetCashier = userService.getCurrentUser();
        if (cashierId != null && !cashierId.equals(targetCashier.getId())) {
            User requested = userRepository.findById(cashierId)
                    .orElseThrow(() -> new Exception("Cashier not found"));
            accessControl.assertCanManageBranch(targetCashier, requested.getBranch());
            targetCashier = requested;
        }

        ShiftReport shiftReport = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(targetCashier)
                .orElseThrow(() -> new Exception("no active shift found for cashier"));

        return buildPopulatedDTO(shiftReport);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteShiftReport(Long id) throws Exception {
        ShiftReport report = shiftReportRepository.findById(id)
                .orElseThrow(() -> new Exception("shift report not found with given id " + id));
        Store reportStore = report.getBranch() != null ? report.getBranch().getStore() : null;
        accessControl.assertStoreLevelOrAdmin(userService.getCurrentUser(), reportStore);
        List<Refund> linkedRefunds = refundRepository.findByShiftReportId(report.getId());
        for (Refund r : linkedRefunds) {
            r.setShiftReport(null);
            refundRepository.save(r);
        }
        shiftReportRepository.delete(report);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftReportDTO getShiftByCashierAndDate(Long cashierId, LocalDateTime date) throws Exception {
        User cashier = userRepository.findById(cashierId).orElseThrow(
                () -> new Exception("cashier not found with id " + cashierId)
        );
        LocalDateTime start = date.toLocalDate().atStartOfDay();
        LocalDateTime end = date.toLocalDate().atTime(LocalTime.MAX);

        ShiftReport report = shiftReportRepository.findTopByCashierAndShiftStartBetweenOrderByShiftStartDesc(
                cashier, start, end
        ).orElseThrow(() -> new Exception("shift not found for date"));
        assertCanViewShift(userService.getCurrentUser(), report);

        return buildPopulatedDTO(report);
    }

    private Branch resolveBranchForShiftStart(User currentUser, Long branchId) throws Exception {
        Branch branch = currentUser.getBranch();
        if (branch == null) {
            throw new Exception("Thu ngân chưa được gán vào chi nhánh nào để bắt đầu ca làm việc.");
        }
        if (branchId != null && !branch.getId().equals(branchId)) {
            throw new AccessDeniedException("You cannot start a shift for another branch");
        }
        return branch;
    }

    private void assertStoreOperationalForShift(Branch branch) throws Exception {
        if (branch.getStore() == null) {
            return;
        }
        StoreStatus status = branch.getStore().getStatus();
        if (status == StoreStatus.BLOCKED) {
            throw new Exception("Store is currently blocked and cannot start a shift");
        }
        if (status == StoreStatus.PENDING || status == StoreStatus.REJECTED) {
            throw new Exception("Store is pending Super Admin approval and cannot start a shift yet");
        }
    }

    private ShiftReportDTO buildPopulatedDTO(ShiftReport shiftReport) {
        if (shiftReport == null) {
            return null;
        }
        if (shiftReport.getCashier() == null || shiftReport.getShiftStart() == null) {
            return ShiftReportMapper.toDTO(shiftReport);
        }
        LocalDateTime end = shiftReport.getShiftEnd() != null ? shiftReport.getShiftEnd() : LocalDateTime.now();
        List<Order> orders = fetchShiftOrders(shiftReport, end);
        List<Refund> refunds = fetchShiftRefunds(shiftReport);

        ShiftMetrics metrics = metricsCalculator.calculateAndAttach(shiftReport, orders, refunds);
        ShiftReportDTO dto = ShiftReportMapper.toDTO(shiftReport);

        // Ca đã đóng: giữ nguyên số liệu đã chốt để màn hình chi tiết luôn khớp với danh sách,
        // không bị đổi khi đơn của ca này được hoàn tiền ở ca sau.
        boolean closedWithSnapshot = shiftReport.getShiftEnd() != null
                && shiftReport.getTotalSales() != null
                && shiftReport.getTotalRefunds() != null
                && shiftReport.getNetSale() != null;
        dto.setTotalSales(closedWithSnapshot ? shiftReport.getTotalSales() : metrics.totalSales());
        dto.setTotalOrders(closedWithSnapshot ? shiftReport.getTotalOrders() : metrics.totalOrders());
        dto.setTotalRefunds(closedWithSnapshot ? shiftReport.getTotalRefunds() : metrics.totalRefunds());
        dto.setNetSale(closedWithSnapshot ? shiftReport.getNetSale() : metrics.netSales());
        dto.setRefunds(refunds.stream().map(RefundMapper::toDTO).collect(Collectors.toList()));
        return dto;
    }

    /**
     * Dùng cho các API trả về danh sách (list): ca đã đóng (shiftEnd != null) dùng trực tiếp số liệu tổng hợp đã lưu,
     * chỉ tính toán động với các ca đang mở (shiftEnd == null) để triệt tiêu hoàn toàn lỗi N+1 Query.
     */
    private ShiftReportDTO toSummaryOrLiveDTO(ShiftReport report) {
        if (report == null) {
            return null;
        }
        if (report.getShiftEnd() == null) {
            return buildPopulatedDTO(report);
        }
        return ShiftReportMapper.toDTO(report);
    }

    private List<Order> fetchShiftOrders(ShiftReport shiftReport, LocalDateTime end) {
        if (shiftReport == null || shiftReport.getCashier() == null || shiftReport.getShiftStart() == null) {
            return Collections.emptyList();
        }
        if (shiftReport.getBranch() != null && shiftReport.getBranch().getId() != null) {
            return orderRepository.findShiftOrdersByBranchAndCashierBetween(
                    shiftReport.getBranch().getId(),
                    shiftReport.getCashier().getId(),
                    shiftReport.getShiftStart(),
                    end
            );
        }
        return orderRepository.findShiftOrdersByCashierBetween(
                shiftReport.getCashier(),
                shiftReport.getShiftStart(),
                end
        );
    }

    private List<Refund> fetchShiftRefunds(ShiftReport shiftReport) {
        if (shiftReport == null || shiftReport.getId() == null) {
            return Collections.emptyList();
        }
        return refundRepository.findByShiftReportId(shiftReport.getId());
    }

    private List<ShiftReport> fetchReportsByRole(User current) {
        if (current.getRole() == UserRole.ROLE_CASHIER) {
            return shiftReportRepository.findByCashierId(current.getId());
        }
        if (current.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            if (current.getBranch() == null) {
                return Collections.emptyList();
            }
            return shiftReportRepository.findByBranchId(current.getBranch().getId());
        }
        if (current.getRole() != UserRole.ROLE_STORE_OWNER) {
            return Collections.emptyList();
        }
        Store store = accessControl.resolveStoreOfUser(current);
        return store != null ? shiftReportRepository.findByBranchStoreId(store.getId()) : Collections.emptyList();
    }

    private List<ShiftReportDTO> mapVisibleReports(User current, List<ShiftReport> reports) {
        return reports.stream()
                .filter(r -> canViewShift(current, r))
                .map(this::toSummaryOrLiveDTO)
                .collect(Collectors.toList());
    }

    private User resolveCurrentUserOrThrowAccessDenied() {
        try {
            return userService.getCurrentUser();
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            throw new AccessDeniedException(e.getMessage() != null ? e.getMessage() : "Unauthorized");
        }
    }

    private boolean canViewShift(User user, ShiftReport report) {
        if (report.getCashier() != null && report.getCashier().getId().equals(user.getId())) {
            return true;
        }
        return accessControl.canManageBranch(user, report.getBranch());
    }

    private void assertCanViewShift(User user, ShiftReport report) {
        if (!canViewShift(user, report)) {
            throw new AccessDeniedException("You do not have permission to view this shift report");
        }
    }
}
