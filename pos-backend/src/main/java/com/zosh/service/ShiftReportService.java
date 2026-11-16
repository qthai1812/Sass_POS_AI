package com.zosh.service;

import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.payload.response.PageResponse;

import java.time.LocalDateTime;
import java.util.List;

public interface ShiftReportService {

    default ShiftReportDTO startShift() throws Exception {
        return startShift(null);
    }

    ShiftReportDTO startShift(Long branchId) throws Exception;

    ShiftReportDTO endShift(Long shiftReportId, LocalDateTime shiftEnd) throws Exception;

    ShiftReportDTO closeShiftInternal(Long shiftReportId, LocalDateTime shiftEnd) throws Exception;

    ShiftReportDTO getShiftReportById(Long id) throws Exception;

    List<ShiftReportDTO> getAllShiftReports();

    PageResponse<ShiftReportDTO> getAllShiftReportsPaged(int page, int size, String sortBy, String sortDir);

    List<ShiftReportDTO> getShiftReportsByBranchId(Long branchId);

    PageResponse<ShiftReportDTO> getShiftReportsByBranchIdPaged(Long branchId, int page, int size, String sortBy, String sortDir) throws Exception;

    List<ShiftReportDTO> getShiftReportsByCashierId(Long cashierId);

    PageResponse<ShiftReportDTO> getShiftReportsByCashierIdPaged(Long cashierId, int page, int size, String sortBy, String sortDir) throws Exception;

    ShiftReportDTO getCurrentShiftProgress(Long cashierId) throws Exception;

    ShiftReportDTO getShiftByCashierAndDate(Long cashierId, LocalDateTime date) throws Exception;

    void deleteShiftReport(Long id) throws Exception;
}
