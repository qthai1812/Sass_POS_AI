package com.zosh.service.store;

import com.zosh.mapper.StoreMapper;
import com.zosh.modal.Store;
import com.zosh.payload.dto.StoreDTO;
import com.zosh.repository.OrderRepository;
import com.zosh.repository.RefundRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Tổng hợp doanh thu thực thu (đã trừ hoàn trả một phần) và tính hoa hồng cho StoreDTO.
 */
@Component
@RequiredArgsConstructor
public class StoreRevenueEnricher {

    private static final double DEFAULT_COMMISSION_RATE = 2.5;

    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;

    public StoreDTO enrich(StoreDTO dto, Double revenue) {
        if (dto == null) {
            return null;
        }
        double safeRevenue = revenue != null ? Math.max(0.0, revenue) : 0.0;
        double rate = dto.getCommissionRate() != null ? dto.getCommissionRate() : DEFAULT_COMMISSION_RATE;
        double earnings = Math.round(safeRevenue * (rate / 100.0) * 100.0) / 100.0;
        dto.setTotalRevenue(safeRevenue);
        dto.setTotalEarnings(earnings);
        return dto;
    }

    public StoreDTO toEnrichedDTO(Store store) {
        if (store == null) {
            return null;
        }
        Double revenue = orderRepository.sumCompletedSalesByStoreId(store.getId());
        return enrich(StoreMapper.toDTO(store), revenue);
    }

    public List<StoreDTO> toEnrichedDTOList(List<Store> stores) {
        Map<Long, Double> netRevenueByStore = computeNetRevenueByStore();
        return stores.stream()
                .map(s -> enrich(StoreMapper.toDTO(s), netRevenueByStore.getOrDefault(s.getId(), 0.0)))
                .collect(Collectors.toList());
    }

    private Map<Long, Double> computeNetRevenueByStore() {
        Map<Long, Double> revenueByStore = new HashMap<>();
        for (Object[] row : orderRepository.sumCompletedSalesGroupedByStore()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number) {
                Long storeId = ((Number) row[0]).longValue();
                double rev = row[1] instanceof Number ? ((Number) row[1]).doubleValue() : 0.0;
                revenueByStore.put(storeId, rev);
            }
        }
        // Trừ đi số tiền hoàn trả một phần (Partial Refund) trên các đơn COMPLETED để doanh thu & hoa hồng chính xác 100%
        for (Object[] row : refundRepository.sumRefundsOnCompletedOrdersGroupedByStore()) {
            if (row != null && row.length >= 2 && row[0] instanceof Number) {
                Long storeId = ((Number) row[0]).longValue();
                double refunded = row[1] instanceof Number ? ((Number) row[1]).doubleValue() : 0.0;
                revenueByStore.computeIfPresent(storeId, (k, gross) -> Math.max(0.0, gross - refunded));
            }
        }
        return revenueByStore;
    }
}
