package com.zosh.service.impl;

import com.zosh.domain.BranchTransferRequestStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Branch;
import com.zosh.modal.BranchTransferRequest;
import com.zosh.modal.ShiftReport;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.BranchTransferRequestDTO;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.BranchTransferRequestRepository;
import com.zosh.repository.ShiftReportRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.AccessControlService;
import com.zosh.service.BranchTransferRequestService;
import com.zosh.service.ShiftReportService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BranchTransferRequestServiceImpl implements BranchTransferRequestService {

    private final BranchTransferRequestRepository transferRequestRepository;
    private final BranchRepository branchRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final ShiftReportRepository shiftReportRepository;
    private final ShiftReportService shiftReportService;
    private final UserService userService;
    private final AccessControlService accessControl;

    private BranchTransferRequestDTO toDTO(BranchTransferRequest entity) {
        if (entity == null) {
            return null;
        }
        User emp = entity.getEmployee();
        Store store = entity.getStore();
        Branch from = entity.getFromBranch();
        Branch to = entity.getToBranch();
        User reviewer = entity.getReviewedBy();

        return BranchTransferRequestDTO.builder()
                .id(entity.getId())
                .employeeId(emp != null ? emp.getId() : null)
                .employeeName(emp != null ? emp.getFullName() : null)
                .employeeEmail(emp != null ? emp.getEmail() : null)
                .employeePhone(emp != null ? emp.getPhone() : null)
                .employeeRole(emp != null ? emp.getRole() : null)
                .storeId(store != null ? store.getId() : null)
                .storeName(store != null ? store.getBrand() : null)
                .fromBranchId(from != null ? from.getId() : null)
                .fromBranchName(from != null ? from.getName() : null)
                .toBranchId(to != null ? to.getId() : null)
                .toBranchName(to != null ? to.getName() : null)
                .reason(entity.getReason())
                .status(entity.getStatus())
                .reviewNote(entity.getReviewNote())
                .reviewedById(reviewer != null ? reviewer.getId() : null)
                .reviewedByName(reviewer != null ? reviewer.getFullName() : null)
                .reviewedAt(entity.getReviewedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BranchTransferRequestDTO createRequest(Long toBranchId, String reason) throws Exception {
        User currentUser = userService.getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_CASHIER
                && currentUser.getRole() != UserRole.ROLE_BRANCH_MANAGER) {
            throw new UserException("Chỉ nhân viên cấp chi nhánh (Thu ngân / Quản lý chi nhánh) mới cần gửi đơn yêu cầu chuyển chi nhánh.");
        }

        Branch currentBranch = currentUser.getBranch();
        if (currentBranch == null) {
            throw new UserException("Tài khoản của bạn hiện chưa được gán vào chi nhánh nào.");
        }

        Store store = accessControl.resolveStoreOfUser(currentUser);
        if (store == null) {
            throw new UserException("Không tìm thấy chuỗi cửa hàng trực thuộc của bạn.");
        }

        if (toBranchId == null) {
            throw new UserException("Vui lòng chọn chi nhánh muốn chuyển đến.");
        }

        if (currentBranch.getId().equals(toBranchId)) {
            throw new UserException("Chi nhánh chuyển đến phải khác chi nhánh hiện tại của bạn.");
        }

        Branch targetBranch = branchRepository.findById(toBranchId)
                .orElseThrow(() -> new UserException("Chi nhánh mục tiêu không tồn tại."));

        if (targetBranch.getStore() == null || !targetBranch.getStore().getId().equals(store.getId())) {
            throw new AccessDeniedException("Chi nhánh mục tiêu không thuộc cùng chuỗi cửa hàng của bạn.");
        }

        String trimmedReason = reason != null ? reason.trim() : "";
        if (trimmedReason.isEmpty()) {
            throw new UserException("Vui lòng nhập lý do xin chuyển chi nhánh.");
        }

        if (transferRequestRepository.existsByEmployeeIdAndStatus(
                currentUser.getId(), BranchTransferRequestStatus.PENDING)) {
            throw new UserException("Bạn đang có một đơn yêu cầu chuyển chi nhánh chờ duyệt. Vui lòng đợi kết quả hoặc hủy đơn hiện tại trước khi tạo đơn mới.");
        }

        BranchTransferRequest request = BranchTransferRequest.builder()
                .employee(currentUser)
                .store(store)
                .fromBranch(currentBranch)
                .toBranch(targetBranch)
                .reason(trimmedReason)
                .status(BranchTransferRequestStatus.PENDING)
                .build();

        BranchTransferRequest saved = transferRequestRepository.save(request);
        return toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BranchTransferRequestDTO> getMyRequests() throws Exception {
        User currentUser = userService.getCurrentUser();
        return transferRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BranchTransferRequestDTO cancelMyRequest(Long requestId) throws Exception {
        User currentUser = userService.getCurrentUser();
        BranchTransferRequest request = transferRequestRepository.findById(requestId)
                .orElseThrow(() -> new UserException("Không tìm thấy đơn yêu cầu chuyển chi nhánh."));

        if (request.getEmployee() == null || !request.getEmployee().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Bạn chỉ có thể hủy đơn yêu cầu của chính mình.");
        }

        if (request.getStatus() != BranchTransferRequestStatus.PENDING) {
            throw new UserException("Chỉ có thể hủy đơn yêu cầu đang ở trạng thái chờ duyệt (PENDING).");
        }

        request.setStatus(BranchTransferRequestStatus.CANCELLED);
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewNote("Nhân viên tự hủy yêu cầu.");
        return toDTO(transferRequestRepository.save(request));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BranchTransferRequestDTO> getStoreRequests(Long storeId) throws Exception {
        User currentUser = userService.getCurrentUser();
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new UserException("Không tìm thấy cửa hàng."));

        if (!accessControl.isStoreLevelUser(currentUser, store)) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng (Store Owner) mới có quyền xem danh sách đơn xin chuyển chi nhánh.");
        }

        return transferRequestRepository.findByStoreIdOrderByCreatedAtDesc(storeId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private void clearPreviousManagedBranches(Long userId, Long keepBranchId) {
        List<Branch> managed = branchRepository.findByManagerId(userId);
        for (Branch b : managed) {
            if (keepBranchId == null || !b.getId().equals(keepBranchId)) {
                b.setManager(null);
                branchRepository.save(b);
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BranchTransferRequestDTO reviewRequest(Long requestId, String action, String reviewNote) throws Exception {
        User currentUser = userService.getCurrentUser();
        BranchTransferRequest request = transferRequestRepository.findById(requestId)
                .orElseThrow(() -> new UserException("Không tìm thấy đơn yêu cầu chuyển chi nhánh."));

        Store store = request.getStore();
        if (!accessControl.isStoreLevelUser(currentUser, store)) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng (Store Owner) mới có quyền phê duyệt hoặc từ chối đơn chuyển chi nhánh.");
        }

        if (request.getStatus() != BranchTransferRequestStatus.PENDING) {
            throw new UserException("Đơn yêu cầu này đã được xử lý trước đó.");
        }

        String normalizedAction = action != null ? action.trim().toUpperCase() : "";
        boolean isApprove = "APPROVE".equals(normalizedAction) || "APPROVED".equals(normalizedAction);
        boolean isReject = "REJECT".equals(normalizedAction) || "REJECTED".equals(normalizedAction);

        if (!isApprove && !isReject) {
            throw new UserException("Hành động phê duyệt không hợp lệ (chỉ chấp nhận APPROVED hoặc REJECTED).");
        }

        LocalDateTime now = LocalDateTime.now();

        if (isApprove) {
            User employee = request.getEmployee();
            Branch targetBranch = request.getToBranch();
            if (employee == null || targetBranch == null) {
                throw new UserException("Thông tin nhân viên hoặc chi nhánh chuyển đến không còn tồn tại.");
            }
            if (targetBranch.getStore() == null || !targetBranch.getStore().getId().equals(store.getId())) {
                throw new UserException("Chi nhánh mục tiêu không thuộc cửa hàng này.");
            }

            // Đóng các ca làm việc đang mở của nhân viên ở chi nhánh cũ trước khi chuyển sang chi nhánh mới
            for (ShiftReport sr : shiftReportRepository.findByCashierId(employee.getId())) {
                if (sr.getShiftEnd() == null) {
                    try {
                        shiftReportService.closeShiftInternal(sr.getId(), now);
                    } catch (Exception ignored) {
                        sr.setShiftEnd(now);
                        shiftReportRepository.save(sr);
                    }
                }
            }

            employee.setBranch(targetBranch);
            employee.setStore(store);
            User savedEmployee = userRepository.save(employee);

            if (savedEmployee.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
                clearPreviousManagedBranches(savedEmployee.getId(), targetBranch.getId());
                targetBranch.setManager(savedEmployee);
                branchRepository.save(targetBranch);
            }

            request.setStatus(BranchTransferRequestStatus.APPROVED);
        } else {
            request.setStatus(BranchTransferRequestStatus.REJECTED);
        }

        request.setReviewedBy(currentUser);
        request.setReviewedAt(now);
        request.setReviewNote(reviewNote != null ? reviewNote.trim() : null);

        return toDTO(transferRequestRepository.save(request));
    }
}
