package com.zosh.service;

import com.zosh.domain.PlanFeature;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.modal.Branch;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.response.AiCopilotDTOs.*;
import com.zosh.repository.BranchRepository;
import com.zosh.repository.StoreRepository;
import com.zosh.service.ai.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiCopilotServiceTest {

    @Mock private ShiftReportService shiftReportService;
    @Mock private AccessControlService accessControl;
    @Mock private PlanLimitChecker planLimitChecker;
    @Mock private UserService userService;
    @Mock private StoreRepository storeRepository;
    @Mock private BranchRepository branchRepository;
    @Mock private StoreBranchInsightService storeBranchInsightService;
    @Mock private CrossSellRecommendationEngine crossSellEngine;
    @Mock private PosVoiceCommandParser voiceCommandParser;
    @Mock private ShiftSummaryAiService shiftSummaryAiService;

    @InjectMocks
    private AiCopilotService aiCopilotService;

    private User owner;
    private Store store;
    private Branch branch;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.ROLE_STORE_OWNER);

        store = new Store();
        store.setId(1L);
        store.setStoreAdmin(owner);
        owner.setStore(store);

        branch = Branch.builder().id(5L).store(store).name("CN1").build();
    }

    @Test
    void analyzeStore_blocksWhenPlanLacksAiFeature_andRejectsSuperAdmin() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(accessControl.resolveStoreOfUser(owner)).thenReturn(store);
        doThrow(new UserException("Plan lacks AI_COPILOT"))
                .when(planLimitChecker).requireActivePlanFeature(store, PlanFeature.AI_COPILOT);

        assertThrows(UserException.class, () -> aiCopilotService.analyzeStore(10L));

        User superAdmin = new User();
        superAdmin.setId(99L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);
        when(userService.getCurrentUser()).thenReturn(superAdmin);

        assertThrows(AccessDeniedException.class, () -> aiCopilotService.analyzeStore(10L));
        verify(storeBranchInsightService, never()).buildStoreInsight(any(), any());
    }

    @Test
    void analyzeBranch_rejectsSuperAdmin() throws Exception {
        User superAdmin = new User();
        superAdmin.setId(99L);
        superAdmin.setRole(UserRole.ROLE_SUPER_ADMIN);
        when(userService.getCurrentUser()).thenReturn(superAdmin);

        assertThrows(AccessDeniedException.class, () -> aiCopilotService.analyzeBranch(5L));
        verify(storeBranchInsightService, never()).buildBranchInsight(any());
    }

    @Test
    void analyzeBranch_validatesAccessAndDelegates() throws Exception {
        when(branchRepository.findById(5L)).thenReturn(Optional.of(branch));
        when(userService.getCurrentUser()).thenReturn(owner);
        AiInsightResponse expected = AiInsightResponse.builder().scope("BRANCH").build();
        when(storeBranchInsightService.buildBranchInsight(branch)).thenReturn(expected);

        AiInsightResponse res = aiCopilotService.analyzeBranch(5L);

        assertSame(expected, res);
        verify(accessControl).assertCanAccessBranch(owner, branch);
        verify(planLimitChecker).requireActivePlanFeature(store, PlanFeature.AI_COPILOT);
    }

    @Test
    void getCrossSellSuggestions_delegatesToRecommendationEngine() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(accessControl.resolveStoreOfUser(owner)).thenReturn(store);
        when(branchRepository.findById(5L)).thenReturn(Optional.of(branch));
        List<CrossSellSuggestion> expected = List.of(CrossSellSuggestion.builder().coOccurrenceScore(15).build());
        when(crossSellEngine.recommend(5L, store, 99L, List.of(1L))).thenReturn(expected);

        List<CrossSellSuggestion> actual = aiCopilotService.getCrossSellSuggestions(5L, 1L, 99L, List.of(1L));

        assertSame(expected, actual);
        verify(accessControl).assertCanAccessBranch(owner, branch);
    }

    @Test
    void parseQuickOrderCommand_rejectsBlankAndDelegatesValidCommand() throws Exception {
        assertThrows(IllegalArgumentException.class,
                () -> aiCopilotService.parseQuickOrderCommand(new QuickCommandRequest(1L, null, "   ")));

        when(userService.getCurrentUser()).thenReturn(owner);
        when(accessControl.resolveStoreOfUser(owner)).thenReturn(store);
        QuickCommandResponse expected = QuickCommandResponse.builder().paymentMethod("CASH").build();
        when(voiceCommandParser.parse(1L, "mua 2 áo")).thenReturn(expected);

        QuickCommandResponse actual = aiCopilotService.parseQuickOrderCommand(new QuickCommandRequest(1L, null, "mua 2 áo"));
        assertSame(expected, actual);
    }

    @Test
    void summarizeShift_whenNoActiveShift_fallsBackToLatestCashierShift() throws Exception {
        when(userService.getCurrentUser()).thenReturn(owner);
        when(accessControl.resolveStoreOfUser(owner)).thenReturn(store);
        when(shiftReportService.getCurrentShiftProgress(null)).thenThrow(new Exception("no active shift"));

        ShiftReportDTO older = ShiftReportDTO.builder().id(11L).shiftStart(LocalDateTime.now().minusDays(2)).build();
        ShiftReportDTO latest = ShiftReportDTO.builder().id(12L).shiftStart(LocalDateTime.now().minusDays(1)).build();
        when(shiftReportService.getShiftReportsByCashierId(10L)).thenReturn(List.of(older, latest));
        when(shiftReportService.getShiftReportById(12L)).thenReturn(latest);

        ShiftAiSummaryResponse expected = ShiftAiSummaryResponse.builder().shiftId(12L).build();
        when(shiftSummaryAiService.buildSummary(latest)).thenReturn(expected);

        ShiftAiSummaryResponse actual = aiCopilotService.summarizeShift(null);
        assertSame(expected, actual);
    }
}
