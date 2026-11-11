package com.zosh.service.analytics;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.UserRole;
import com.zosh.modal.*;
import com.zosh.payload.response.StoreAlertsDTO;
import com.zosh.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreAlertScannerTest {

    @Mock private BranchRepository branchRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private UserRepository userRepository;
    @Mock private RefundRepository refundRepository;
    @Spy private AnalyticsCalculationHelper calcHelper = new AnalyticsCalculationHelper();

    @InjectMocks
    private StoreAlertScanner scanner;

    @Test
    void scanStoreAlerts_detectsNoSaleLowStockInactiveCashierAndRecentRefunds() {
        Store store = new Store();
        store.setId(1L);
        Branch b1 = Branch.builder().id(10L).name("Q1 Branch").store(store).build();

        when(branchRepository.findByStoreId(1L)).thenReturn(List.of(b1));
        // Only a PENDING order today -> branch still triggers noSaleToday
        when(orderRepository.findByBranchIdAndCreatedAtBetween(eq(10L), any(), any()))
                .thenReturn(List.of(Order.builder().id(1L).status(OrderStatus.PENDING).build()));

        Product lowProd = Product.builder().id(50L).name("Polo Shirt").sku("SKU-50").build();
        Inventory lowInv = Inventory.builder().id(100L).branch(b1).product(lowProd).quantity(3).minStockLevel(5).build();
        Inventory okInv = Inventory.builder().id(101L).branch(b1).product(lowProd).quantity(20).minStockLevel(5).build();
        when(inventoryRepository.findByBranchId(10L)).thenReturn(List.of(lowInv, okInv));

        User inactiveCashier = new User();
        inactiveCashier.setId(200L);
        inactiveCashier.setRole(UserRole.ROLE_CASHIER);
        inactiveCashier.setLastLogin(LocalDateTime.now().minusDays(10));

        User activeCashier = new User();
        activeCashier.setId(201L);
        activeCashier.setRole(UserRole.ROLE_CASHIER);
        activeCashier.setLastLogin(LocalDateTime.now().minusDays(1));
        when(userRepository.findByBranchId(10L)).thenReturn(List.of(inactiveCashier, activeCashier));

        Refund recentRefund = Refund.builder().id(300L).amount(50000.0).createdAt(LocalDateTime.now().minusDays(2)).build();
        Refund oldRefund = Refund.builder().id(301L).amount(50000.0).createdAt(LocalDateTime.now().minusDays(15)).build();
        when(refundRepository.findByBranchId(10L)).thenReturn(List.of(recentRefund, oldRefund));

        StoreAlertsDTO alerts = scanner.scanStoreAlerts(1L);

        assertEquals(1, alerts.getNoSaleToday().size());
        assertEquals(1, alerts.getLowStockAlerts().size());
        assertEquals("Polo Shirt (Q1 Branch)", alerts.getLowStockAlerts().get(0).getName());
        assertEquals(3, alerts.getLowStockAlerts().get(0).getQuantity());
        assertEquals(1, alerts.getInactiveCashiers().size());
        assertEquals(1, alerts.getRefundSpike().size());
    }
}
