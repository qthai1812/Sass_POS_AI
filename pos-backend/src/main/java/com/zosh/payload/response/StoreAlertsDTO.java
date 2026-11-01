package com.zosh.payload.response;

import com.zosh.payload.dto.BranchDTO;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.dto.UserDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoreAlertsDTO {
    private List<UserDto> inactiveCashiers;
    private List<ProductDTO> lowStockAlerts;
    private List<BranchDTO> noSaleToday;
    private List<Object> refundSpike; // You can define a specific DTO for refund spikes if needed
}
