package com.zosh.service.employee;

import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.repository.*;
import com.zosh.service.ShiftReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Xử lý vòng đời nhân sự: gán/gỡ quản lý chi nhánh, tự động đóng ca mở khi khóa tài khoản và dọn khóa ngoại trước khi xóa.
 */
@Component
@RequiredArgsConstructor
public class EmployeeLifecycleService {

    private final BranchRepository branchRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final OrderRepository orderRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final RefundRepository refundRepository;
    private final BranchTransferRequestRepository branchTransferRequestRepository;
    private final UserRepository userRepository;
    private final ShiftReportService shiftReportService;

    public void clearPreviousManagedBranches(Long userId, Long keepBranchId) {
        List<Branch> managed = branchRepository.findByManagerId(userId);
        for (Branch b : managed) {
            if (keepBranchId == null || !b.getId().equals(keepBranchId)) {
                b.setManager(null);
                branchRepository.save(b);
            }
        }
    }

    public void syncManagedBranchAfterSave(User savedEmployee, Branch assignedBranch) {
        if (savedEmployee.getRole() == UserRole.ROLE_BRANCH_MANAGER && assignedBranch != null) {
            clearPreviousManagedBranches(savedEmployee.getId(), assignedBranch.getId());
            assignedBranch.setManager(savedEmployee);
            branchRepository.save(assignedBranch);
        } else {
            clearPreviousManagedBranches(savedEmployee.getId(), null);
        }
    }

    public void closeOpenShiftsForEmployee(Long employeeId) {
        LocalDateTime now = LocalDateTime.now();
        for (ShiftReport sr : shiftReportRepository.findByCashierId(employeeId)) {
            if (sr.getShiftEnd() == null) {
                try {
                    shiftReportService.closeShiftInternal(sr.getId(), now);
                } catch (Exception ignored) {
                    sr.setShiftEnd(now);
                    shiftReportRepository.save(sr);
                }
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteEmployeeWithCleanup(User employee) {
        Long employeeId = employee.getId();

        // Gỡ liên kết manager trong bảng Branch trước khi xóa để tránh lỗi khóa ngoại
        clearPreviousManagedBranches(employeeId, null);

        // Xóa PasswordResetToken và BranchTransferRequest nếu có
        passwordResetTokenRepository.deleteByUserId(employeeId);
        branchTransferRequestRepository.deleteByEmployeeId(employeeId);

        // Gỡ liên kết cashier trên Order, ShiftReport, Refund để tránh lỗi khóa ngoại
        for (Order o : orderRepository.findByCashierId(employeeId)) {
            o.setCashier(null);
            orderRepository.save(o);
        }

        LocalDateTime now = LocalDateTime.now();
        for (ShiftReport sr : shiftReportRepository.findByCashierId(employeeId)) {
            if (sr.getShiftEnd() == null) {
                try {
                    shiftReportService.closeShiftInternal(sr.getId(), now);
                } catch (Exception ignored) {
                    sr.setShiftEnd(now);
                }
            }
            sr.setCashier(null);
            shiftReportRepository.save(sr);
        }

        for (Refund r : refundRepository.findByCashierId(employeeId)) {
            r.setCashier(null);
            refundRepository.save(r);
        }

        userRepository.delete(employee);
    }
}
