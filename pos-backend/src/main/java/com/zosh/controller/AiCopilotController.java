package com.zosh.controller;

import com.zosh.payload.response.AiCopilotDTOs.*;
import com.zosh.service.AiCopilotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai")
public class AiCopilotController {

    private final AiCopilotService aiCopilotService;

    @GetMapping("/store-insights/{storeAdminId}")
    public ResponseEntity<AiInsightResponse> getStoreAiInsights(
            @PathVariable Long storeAdminId
    ) throws Exception {
        return ResponseEntity.ok(aiCopilotService.analyzeStore(storeAdminId));
    }

    @GetMapping("/branch-insights/{branchId}")
    public ResponseEntity<AiInsightResponse> getBranchAiInsights(
            @PathVariable Long branchId
    ) throws Exception {
        return ResponseEntity.ok(aiCopilotService.analyzeBranch(branchId));
    }

    @PostMapping("/pos/cross-sell")
    public ResponseEntity<List<CrossSellSuggestion>> getCrossSellSuggestions(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) Long storeId,
            @RequestParam(required = false) Long customerId,
            @RequestBody(required = false) List<Long> cartProductIds
    ) throws Exception {
        return ResponseEntity.ok(
                aiCopilotService.getCrossSellSuggestions(branchId, storeId, customerId, cartProductIds)
        );
    }

    @PostMapping("/pos/quick-command")
    public ResponseEntity<QuickCommandResponse> parseQuickCommand(
            @RequestBody QuickCommandRequest request
    ) throws Exception {
        return ResponseEntity.ok(aiCopilotService.parseQuickOrderCommand(request));
    }

    @GetMapping("/shift-summary")
    public ResponseEntity<ShiftAiSummaryResponse> getShiftAiSummary(
            @RequestParam(required = false) Long shiftId
    ) throws Exception {
        return ResponseEntity.ok(aiCopilotService.summarizeShift(shiftId));
    }
}
