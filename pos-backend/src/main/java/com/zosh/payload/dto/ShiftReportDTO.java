package com.zosh.payload.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.zosh.modal.PaymentSummary;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShiftReportDTO {

    private Long id;

    private LocalDateTime shiftStart;
    private LocalDateTime shiftEnd;

    private Double totalSales;
    private Double totalRefunds;
    private Double netSale;
    private int totalOrders;

    private UserDto cashier;
    private Long cashierId;
    private Long branchId;

    private BranchDTO branch;

    private List<PaymentSummary> paymentSummaries;

    private List<ProductDTO> topSellingProducts;

    private List<OrderDTO> recentOrders;

    private List<RefundDTO> refunds;

    @JsonProperty("netSales")
    public Double getNetSales() {
        return netSale;
    }

    @JsonProperty("netSales")
    public void setNetSales(Double val) {
        if (this.netSale == null && val != null) {
            this.netSale = val;
        }
    }
}
