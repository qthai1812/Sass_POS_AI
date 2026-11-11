package com.zosh.service.analytics;

import com.zosh.domain.UserRole;
import com.zosh.mapper.BranchMapper;
import com.zosh.mapper.ProductMapper;
import com.zosh.mapper.RefundMapper;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.Branch;
import com.zosh.modal.Inventory;
import com.zosh.modal.Order;
import com.zosh.modal.Refund;
import com.zosh.modal.User;
import com.zosh.payload.dto.BranchDTO;
import com.zosh.payload.dto.ProductDTO;
import com.zosh.payload.dto.UserDto;
import com.zosh.payload.response.StoreAlertsDTO;
import com.zosh.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Quét cảnh báo vận hành toàn cửa hàng: chi nhánh chưa phát sinh đơn hôm nay, tồn kho thấp,
 * thu ngân lâu chưa đăng nhập và đột biến hoàn tiền 7 ngày gần nhất.
 */
@Component
@RequiredArgsConstructor
public class StoreAlertScanner {

    private final BranchRepository branchRepository;
    private final OrderRepository orderRepository;
    private final InventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final RefundRepository refundRepository;
    private final AnalyticsCalculationHelper calcHelper;

    public StoreAlertsDTO scanStoreAlerts(Long storeId) {
        List<Branch> branches = branchRepository.findByStoreId(storeId);

        Map<String, ProductDTO> lowStockAlertMap = new LinkedHashMap<>();
        List<BranchDTO> noSaleToday = new ArrayList<>();
        List<UserDto> inactiveCashiers = new ArrayList<>();
        List<Object> refundSpike = new ArrayList<>();

        LocalDate today = LocalDate.now();
        LocalDateTime cutoff7Days = LocalDateTime.now().minusDays(7);

        for (Branch branch : branches) {
            appendNoSaleBranchAlert(branch, today, noSaleToday);
            appendLowStockAlerts(branch, lowStockAlertMap);
            appendInactiveCashierAlerts(branch, cutoff7Days, inactiveCashiers);
            appendRecentRefunds(branch, cutoff7Days, refundSpike);
        }

        return StoreAlertsDTO.builder()
                .inactiveCashiers(inactiveCashiers)
                .lowStockAlerts(new ArrayList<>(lowStockAlertMap.values()))
                .noSaleToday(noSaleToday)
                .refundSpike(refundSpike)
                .build();
    }

    private void appendNoSaleBranchAlert(Branch branch, LocalDate today, List<BranchDTO> noSaleToday) {
        List<Order> todayOrders = calcHelper.filterRevenueOrders(
                orderRepository.findByBranchIdAndCreatedAtBetween(
                        branch.getId(), today.atStartOfDay(), today.plusDays(1).atStartOfDay())
        );
        if (todayOrders.isEmpty()) {
            noSaleToday.add(BranchMapper.toDTO(branch));
        }
    }

    private void appendLowStockAlerts(Branch branch, Map<String, ProductDTO> lowStockAlertMap) {
        List<Inventory> inventories = inventoryRepository.findByBranchId(branch.getId());
        for (Inventory inv : inventories) {
            if (inv.getQuantity() != null
                    && inv.getMinStockLevel() != null
                    && inv.getQuantity() <= inv.getMinStockLevel()
                    && inv.getProduct() != null
                    && inv.getProduct().getId() != null) {
                ProductDTO dto = ProductMapper.toDTO(inv.getProduct());
                dto.setQuantity(inv.getQuantity());
                dto.setName(inv.getProduct().getName() + " (" + branch.getName() + ")");
                lowStockAlertMap.put(branch.getId() + "-" + inv.getProduct().getId(), dto);
            }
        }
    }

    private void appendInactiveCashierAlerts(Branch branch, LocalDateTime cutoff7Days, List<UserDto> inactiveCashiers) {
        List<User> branchUsers = userRepository.findByBranchId(branch.getId());
        for (User cashier : branchUsers) {
            if (cashier.getRole() == UserRole.ROLE_CASHIER
                    && (cashier.getLastLogin() == null || cashier.getLastLogin().isBefore(cutoff7Days))) {
                inactiveCashiers.add(UserMapper.toDTO(cashier));
            }
        }
    }

    private void appendRecentRefunds(Branch branch, LocalDateTime cutoff7Days, List<Object> refundSpike) {
        List<Refund> branchRefunds = refundRepository.findByBranchId(branch.getId());
        for (Refund refund : branchRefunds) {
            if (refund.getCreatedAt() == null || !refund.getCreatedAt().isBefore(cutoff7Days)) {
                refundSpike.add(RefundMapper.toDTO(refund));
            }
        }
    }
}
