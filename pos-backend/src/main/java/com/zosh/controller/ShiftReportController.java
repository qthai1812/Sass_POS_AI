package com.zosh.controller;

import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.response.ApiResponse;
import com.zosh.payload.response.PageResponse;
import com.zosh.service.ShiftReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/shift-reports")
public class ShiftReportController {

    private final ShiftReportService shiftReportService;

    @PreAuthorize("hasRole('CASHIER')")
    @PostMapping("/start")
    public ResponseEntity<ShiftReportDTO> startShift(
            @RequestParam(required = false) Long branchId
    ) throws Exception {
        return ResponseEntity.ok(shiftReportService.startShift(branchId));
    }

    @PreAuthorize("hasRole('CASHIER')")
    @PatchMapping("/end")
    public ResponseEntity<ShiftReportDTO> endShift(
            @RequestParam(required = false) Long shiftReportId
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.endShift(shiftReportId, LocalDateTime.now())
        );
    }

    @PreAuthorize("hasRole('CASHIER')")
    @GetMapping("/current")
    public ResponseEntity<ShiftReportDTO> getCurrentShiftProgress(
            @RequestParam(required = false) Long cashierId
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getCurrentShiftProgress(cashierId)
        );
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @GetMapping
    public ResponseEntity<List<ShiftReportDTO>> getAllShiftReports() {
        return ResponseEntity.ok(shiftReportService.getAllShiftReports());
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @GetMapping("/paged")
    public ResponseEntity<PageResponse<ShiftReportDTO>> getAllShiftReportsPaged(
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "shiftStart") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir
    ) {
        return ResponseEntity.ok(shiftReportService.getAllShiftReportsPaged(page, size, sortBy, sortDir));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{cashierId}/by-date")
    public ResponseEntity<ShiftReportDTO> getShiftReportByDate(
            @PathVariable Long cashierId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime date
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftByCashierAndDate(cashierId, date)
        );
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{cashierId}")
    public ResponseEntity<List<ShiftReportDTO>> getShiftReportByCashier(
            @PathVariable Long cashierId
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftReportsByCashierId(cashierId)
        );
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/cashier/{cashierId}/paged")
    public ResponseEntity<PageResponse<ShiftReportDTO>> getShiftReportByCashierPaged(
            @PathVariable Long cashierId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "shiftStart") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftReportsByCashierIdPaged(cashierId, page, size, sortBy, sortDir)
        );
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}")
    public ResponseEntity<List<ShiftReportDTO>> getShiftReportByBranch(
            @PathVariable Long branchId
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftReportsByBranchId(branchId)
        );
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/branch/{branchId}/paged")
    public ResponseEntity<PageResponse<ShiftReportDTO>> getShiftReportByBranchPaged(
            @PathVariable Long branchId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "shiftStart") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftReportsByBranchIdPaged(branchId, page, size, sortBy, sortDir)
        );
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<ShiftReportDTO> getShiftReportById(
            @PathVariable Long id
    ) throws Exception {
        return ResponseEntity.ok(
                shiftReportService.getShiftReportById(id)
        );
    }

    @PreAuthorize("denyAll()")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteShiftReport(
            @PathVariable Long id
    ) throws Exception {
        shiftReportService.deleteShiftReport(id);
        ApiResponse res = new ApiResponse();
        res.setMessage("Shift report deleted successfully");
        return ResponseEntity.ok(res);
    }
}
