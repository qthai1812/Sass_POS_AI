package com.zosh.service;

import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.response.AiCopilotDTOs.*;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.ai.CrossSellRecommendationEngine;
import com.zosh.service.ai.PosVoiceCommandParser;
import com.zosh.service.ai.ShiftSummaryAiService;
import com.zosh.service.ai.StoreBranchInsightService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiCopilotService {

    private final ShiftReportService shiftReportService;
    private final AccessControlService accessControl;
    private final PlanLimitChecker planLimitChecker;
    private final UserService userService;
    private final StoreRepository storeRepository;
    private final BranchRepository branchRepository;

    private final StoreBranchInsightService storeBranchInsightService;
    private final CrossSellRecommendationEngine crossSellEngine;
    private final PosVoiceCommandParser voiceCommandParser;
    private final ShiftSummaryAiService shiftSummaryAiService;

    /**
     * Kiểm tra bắt buộc gói cước của Store phải đang ACTIVE/TRIAL và có bật cờ AI_COPILOT.
     * Nếu không thỏa mãn -> Chặn cả Chủ Store, Quản lý chi nhánh và Thu ngân.
     */
    private void assertAiFeatureEnabled(Store store) throws Exception {
        User current = userService.getCurrentUser();
        if (current != null && current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin không sử dụng AI Copilot bán lẻ nội bộ của cửa hàng.");
        }
        planLimitChecker.requireActivePlanFeature(store, PlanFeature.AI_COPILOT);
    }

    // =========================================================================
    // ƯU TIÊN 1A: AI INSIGHTS & SMART RESTOCK/COUPON CHO CHỦ CỬA HÀNG (STORE)
    // =========================================================================
    public AiInsightResponse analyzeStore(Long storeAdminId) throws Exception {
        User current = userService.getCurrentUser();
        if (current == null || current.getRole() != UserRole.ROLE_STORE_OWNER) {
            throw new AccessDeniedException("Chỉ Chủ cửa hàng (Store Owner) mới có quyền xem AI Insights cấp chuỗi.");
        }
        Store store = accessControl.resolveStoreOfUser(current);
        if (store == null && storeAdminId != null) {
            store = storeRepository.findByStoreAdminId(storeAdminId);
            if (store == null) {
                store = storeRepository.findById(storeAdminId).orElse(null);
            }
        }
        if (store == null) {
            throw new Exception("Store not found for analyzing AI insights");
        }
        accessControl.assertCanAccessStore(current, store);
        assertAiFeatureEnabled(store);

        // Luôn truyền đúng User ID (chủ cửa hàng) cho StoreAnalyticsService
        Long effectiveUserId = (store.getStoreAdmin() != null)
                ? store.getStoreAdmin().getId()
                : current.getId();

        return storeBranchInsightService.buildStoreInsight(store, effectiveUserId);
    }

    // =========================================================================
    // ƯU TIÊN 1B: AI INSIGHTS & SMART RESTOCK CHO QUẢN LÝ CHI NHÁNH (BRANCH)
    // =========================================================================
    public AiInsightResponse analyzeBranch(Long branchId) throws Exception {
        User current = userService.getCurrentUser();
        if (current != null && current.getRole() == UserRole.ROLE_SUPER_ADMIN) {
            throw new AccessDeniedException("Super Admin không sử dụng AI Copilot bán lẻ nội bộ của chi nhánh.");
        }
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new Exception("Branch not found: " + branchId));
        accessControl.assertCanAccessBranch(current, branch);
        assertAiFeatureEnabled(branch.getStore());
        return storeBranchInsightService.buildBranchInsight(branch);
    }

    // =========================================================================
    // ƯU TIÊN 2A: GỢI Ý BÁN CHÉO (AI CROSS-SELL / UPSELL) TẠI QUẦY POS
    // =========================================================================
    public List<CrossSellSuggestion> getCrossSellSuggestions(
            Long branchId,
            Long storeId,
            Long customerId,
            List<Long> cartProductIds
    ) throws Exception {
        User current = userService.getCurrentUser();
        Store store = resolveAccessibleStore(current, storeId);
        if (branchId != null) {
            Branch branch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new Exception("Branch not found: " + branchId));
            accessControl.assertCanAccessBranch(current, branch);
            if (store == null) {
                store = branch.getStore();
            }
        }
        if (store != null) {
            accessControl.assertCanAccessStore(current, store);
        }
        assertAiFeatureEnabled(store);
        return crossSellEngine.recommend(branchId, store, customerId, cartProductIds);
    }

    // =========================================================================
    // ƯU TIÊN 2B: LÊN ĐƠN NHANH BẰNG NGÔN NGỮ TỰ NHIÊN / GIỌNG NÓI (QUICK COMMAND)
    // =========================================================================
    public QuickCommandResponse parseQuickOrderCommand(QuickCommandRequest req) throws Exception {
        if (req == null || req.getCommand() == null || req.getCommand().isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập hoặc đọc câu lệnh lên đơn nhanh");
        }
        User current = userService.getCurrentUser();
        Store store = resolveAccessibleStore(current, req.getStoreId());
        if (store == null) {
            throw new IllegalArgumentException("Không xác định được cửa hàng hiện tại");
        }
        accessControl.assertCanAccessStore(current, store);
        assertAiFeatureEnabled(store);
        return voiceCommandParser.parse(store.getId(), req.getCommand());
    }

    // =========================================================================
    // ƯU TIÊN 2C: TÓM TẮT BÀN GIAO CA TỰ ĐỘNG (SHIFT SUMMARY AI)
    // =========================================================================
    // NOT_SUPPORTED: không bọc transaction readOnly của class; getCurrentShiftProgress có ghi DB và tự quản lý
    // transaction riêng (lỗi "no active shift" cũng không làm hỏng transaction của hàm này).
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ShiftAiSummaryResponse summarizeShift(Long shiftId) throws Exception {
        User current = userService.getCurrentUser();
        Store store = accessControl.resolveStoreOfUser(current);
        assertAiFeatureEnabled(store);

        ShiftReportDTO shift = resolveShiftForSummary(shiftId, current);
        return shiftSummaryAiService.buildSummary(shift);
    }

    private Store resolveAccessibleStore(User current, Long requestedStoreId) {
        Store store = accessControl.resolveStoreOfUser(current);
        if (requestedStoreId != null) {
            Store requestedStore = storeRepository.findById(requestedStoreId).orElse(null);
            if (requestedStore != null) {
                accessControl.assertCanAccessStore(current, requestedStore);
                if (store == null) {
                    store = requestedStore;
                }
            }
        }
        return store;
    }

    private ShiftReportDTO resolveShiftForSummary(Long shiftId, User current) throws Exception {
        if (shiftId != null) {
            return shiftReportService.getShiftReportById(shiftId);
        }
        try {
            return shiftReportService.getCurrentShiftProgress(null);
        } catch (Exception e) {
            // Fallback: thu ngân vừa đóng ca -> lấy ca gần nhất của thu ngân đó
            List<ShiftReportDTO> myShifts = shiftReportService.getShiftReportsByCashierId(current.getId());
            if (myShifts == null || myShifts.isEmpty()) {
                throw new Exception("Chưa có dữ liệu ca làm việc nào để tóm tắt.");
            }
            Long latestShiftId = myShifts.stream()
                    .max(Comparator.comparing(ShiftReportDTO::getShiftStart,
                            Comparator.nullsFirst(Comparator.naturalOrder())))
                    .map(ShiftReportDTO::getId)
                    .orElseThrow(() -> new Exception("Không tìm thấy ca làm việc."));
            return shiftReportService.getShiftReportById(latestShiftId);
        }
    }
}
