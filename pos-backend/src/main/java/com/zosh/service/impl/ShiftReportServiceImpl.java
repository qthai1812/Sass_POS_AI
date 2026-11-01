package com.zosh.service.impl;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.mapper.RefundMapper;
import com.zosh.mapper.ShiftReportMapper;
import com.zosh.modal.*;
import com.zosh.payload.dto.ShiftReportDTO;
import com.zosh.repository.*;
import com.zosh.service.AccessControlService;
import com.zosh.service.ShiftReportService;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftReportServiceImpl implements ShiftReportService {

    private final ShiftReportRepository shiftReportRepository;
    private final UserService userService;
    private final BranchRepository branchRepository;
    private final RefundRepository refundRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControl;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO startShift(Long branchId) throws Exception {
        User currentUser = userService.getCurrentUser();

        Optional<ShiftReport> activeShift = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(currentUser);
        if (activeShift.isPresent()) {
            return getCurrentShiftProgress(currentUser.getId());
        }

        Branch branch = currentUser.getBranch();
        if (branch != null) {
            if (branchId != null && !branch.getId().equals(branchId)) {
                Branch requestedBranch = branchRepository.findById(branchId)
                        .orElseThrow(() -> new Exception("Branch not found with id: " + branchId));
                if (!accessControl.canManageBranch(currentUser, requestedBranch)) {
                    throw new AccessDeniedException("You cannot start a shift for another branch");
                }
                branch = requestedBranch;
            }
        } else if (branchId != null) {
            Branch requestedBranch = branchRepository.findById(branchId)
                    .orElseThrow(() -> new Exception("Branch not found with id: " + branchId));
            accessControl.assertCanAccessBranch(currentUser, requestedBranch);
            branch = requestedBranch;
        } else {
            // Tài khoản cấp Store không gắn cứng branch_id và chưa truyền branchId -> tự chọn chi nhánh đầu tiên nếu Store chỉ có 1 chi nhánh
            Store store = accessControl.resolveStoreOfUser(currentUser);
            if (store != null) {
                List<Branch> storeBranches = branchRepository.findByStoreId(store.getId());
                if (storeBranches.size() == 1) {
                    branch = storeBranches.get(0);
                }
            }
            if (branch == null) {
                throw new Exception("Please specify branchId or assign your account to a branch before starting a shift");
            }
        }

        if (branch.getStore() != null) {
            if (branch.getStore().getStatus() == StoreStatus.BLOCKED) {
                throw new Exception("Store is currently blocked and cannot start a shift");
            }
            if (branch.getStore().getStatus() == StoreStatus.PENDING) {
                throw new Exception("Store is pending Super Admin approval and cannot start a shift yet");
            }
        }

        ShiftReport shiftReport = ShiftReport.builder()
                .cashier(currentUser)
                .shiftStart(LocalDateTime.now())
                .branch(branch)
                .totalSales(0.0)
                .totalRefunds(0.0)
                .netSale(0.0)
                .totalOrders(0)
                .build();

        ShiftReport savedReport = shiftReportRepository.save(shiftReport);
        return ShiftReportMapper.toDTO(savedReport);
    }

    /**
     * Doanh thu gộp của ca gồm các đơn đã thu tiền trong ca: COMPLETED và REFUNDED
     * (đơn REFUNDED đã từng thu tiền thành công; khoản hoàn được trừ riêng ở ca phát sinh phiếu hoàn).
     * Loại bỏ đơn PENDING (chưa thanh toán) và CANCELLED (đã hủy).
     */
    private boolean isCompletedSalesOrder(Order order) {
        return order != null
                && (order.getStatus() == null
                || order.getStatus() == OrderStatus.COMPLETED
                || order.getStatus() == OrderStatus.REFUNDED);
    }

    private List<Order> filterValidSalesOrders(List<Order> orders) {
        if (orders == null) {
            return Collections.emptyList();
        }
        return orders.stream()
                .filter(this::isCompletedSalesOrder)
                .collect(Collectors.toList());
    }

    private List<Order> fetchShiftOrders(ShiftReport shiftReport, LocalDateTime end) {
        if (shiftReport == null || shiftReport.getCashier() == null || shiftReport.getShiftStart() == null) {
            return Collections.emptyList();
        }
        if (shiftReport.getBranch() != null && shiftReport.getBranch().getId() != null) {
            return orderRepository.findByBranchIdAndCashierIdAndCreatedAtBetween(
                    shiftReport.getBranch().getId(),
                    shiftReport.getCashier().getId(),
                    shiftReport.getShiftStart(),
                    end
            );
        }
        return orderRepository.findByCashierAndCreatedAtBetween(
                shiftReport.getCashier(),
                shiftReport.getShiftStart(),
                end
        );
    }

    private List<Refund> fetchShiftRefunds(ShiftReport shiftReport) {
        if (shiftReport == null || shiftReport.getId() == null) {
            return Collections.emptyList();
        }
        return refundRepository.findByShiftReportId(shiftReport.getId());
    }

    /**
     * Net Sales của ca = doanh thu gộp (đơn COMPLETED + REFUNDED thu tiền trong ca)
     * trừ tổng các phiếu hoàn tiền phát sinh TRONG ca này (liên kết qua shiftReportId).
     * Mỗi khoản hoàn chỉ bị trừ đúng 1 lần ở ca phát sinh, dù đơn gốc thuộc ca nào.
     */
    private double computeNetSales(double grossShiftSales, double shiftRefundsTotal) {
        return grossShiftSales - shiftRefundsTotal;
    }

    private List<PaymentSummary> getPaymentSummaries(List<Order> orders) {
        List<Order> completedOrders = filterValidSalesOrders(orders);
        double completedTotal = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();
        Map<PaymentType, List<Order>> grouped = completedOrders.stream()
                .collect(Collectors.groupingBy(order -> order.getPaymentType() != null ? order.getPaymentType() : PaymentType.CASH));

        List<PaymentSummary> summaries = new ArrayList<>();
        for (Map.Entry<PaymentType, List<Order>> entry : grouped.entrySet()) {
            double amount = entry.getValue().stream()
                    .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                    .sum();
            int transactions = entry.getValue().size();
            double percent = completedTotal > 0 ? (amount / completedTotal) * 100.0 : 0.0;

            PaymentSummary ps = new PaymentSummary();
            ps.setType(entry.getKey());
            ps.setTotalAmount(amount);
            ps.setTransactionCount(transactions);
            ps.setPercentage(percent);
            summaries.add(ps);
        }
        return summaries;
    }

    private List<Product> getTopSellingProducts(List<Order> orders) {
        List<Order> validOrders = filterValidSalesOrders(orders);
        Map<Long, Product> productMap = new HashMap<>();
        Map<Long, Integer> productSalesMap = new HashMap<>();
        for (Order order : validOrders) {
            if (order.getItems() == null) continue;
            for (OrderItem item : order.getItems()) {
                Product product = item.getProduct();
                if (product != null && product.getId() != null) {
                    productMap.putIfAbsent(product.getId(), product);
                    int qty = item.getQuantity() != null ? item.getQuantity() : 0;
                    productSalesMap.put(product.getId(), productSalesMap.getOrDefault(product.getId(), 0) + qty);
                }
            }
        }
        return productSalesMap.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(entry -> {
                    Product p = productMap.get(entry.getKey());
                    return Product.builder()
                            .id(p.getId())
                            .name(p.getName())
                            .sku(p.getSku())
                            .description(p.getDescription())
                            .mrp(p.getMrp())
                            .sellingPrice(p.getSellingPrice())
                            .brand(p.getBrand())
                            .color(p.getColor())
                            .image(p.getImage())
                            .quantity(entry.getValue())
                            .category(p.getCategory())
                            .store(p.getStore())
                            .createdAt(p.getCreatedAt())
                            .updatedAt(p.getUpdatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private List<Order> getRecentOrders(List<Order> orders) {
        if (orders == null) {
            return Collections.emptyList();
        }
        return orders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .collect(Collectors.toList());
    }

    private ShiftReportDTO buildPopulatedDTO(ShiftReport shiftReport) {
        if (shiftReport == null) {
            return null;
        }
        if (shiftReport.getCashier() == null || shiftReport.getShiftStart() == null) {
            return ShiftReportMapper.toDTO(shiftReport);
        }
        LocalDateTime end = shiftReport.getShiftEnd() != null ? shiftReport.getShiftEnd() : LocalDateTime.now();
        List<Order> orders = fetchShiftOrders(shiftReport, end);
        List<Refund> refunds = fetchShiftRefunds(shiftReport);

        List<Order> completedOrders = filterValidSalesOrders(orders);
        double totalSales = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();
        int totalOrders = completedOrders.size();
        double totalRefunds = refunds.stream()
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();
        double netSales = computeNetSales(totalSales, totalRefunds);

        shiftReport.setRecentOrders(getRecentOrders(orders));
        shiftReport.setTopSellingProducts(getTopSellingProducts(orders));
        shiftReport.setPaymentSummaries(getPaymentSummaries(orders));

        ShiftReportDTO dto = ShiftReportMapper.toDTO(shiftReport);
        // Ca đã đóng: giữ nguyên số liệu đã chốt để màn hình chi tiết luôn khớp với danh sách,
        // không bị đổi khi đơn của ca này được hoàn tiền ở ca sau.
        boolean closedWithSnapshot = shiftReport.getShiftEnd() != null
                && shiftReport.getTotalSales() != null
                && shiftReport.getTotalRefunds() != null
                && shiftReport.getNetSale() != null;
        dto.setTotalSales(closedWithSnapshot ? shiftReport.getTotalSales() : totalSales);
        dto.setTotalOrders(closedWithSnapshot ? shiftReport.getTotalOrders() : totalOrders);
        dto.setTotalRefunds(closedWithSnapshot ? shiftReport.getTotalRefunds() : totalRefunds);
        dto.setNetSale(closedWithSnapshot ? shiftReport.getNetSale() : netSales);
        dto.setRefunds(refunds.stream().map(RefundMapper::toDTO).collect(Collectors.toList()));
        return dto;
    }

    /**
     * Dùng cho các API trả về danh sách (list): ca đã đóng (shiftEnd != null) dùng trực tiếp số liệu tổng hợp đã lưu,
     * chỉ tính toán động với các ca đang mở (shiftEnd == null) để triệt tiêu hoàn toàn lỗi N+1 Query.
     */
    private ShiftReportDTO toSummaryOrLiveDTO(ShiftReport report) {
        if (report == null) {
            return null;
        }
        if (report.getShiftEnd() == null) {
            return buildPopulatedDTO(report);
        }
        return ShiftReportMapper.toDTO(report);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftReportDTO getShiftReportById(Long id) throws Exception {
        ShiftReport report = shiftReportRepository.findById(id)
                .orElseThrow(() -> new Exception("shift report not found with given id " + id));
        assertCanViewShift(userService.getCurrentUser(), report);
        return buildPopulatedDTO(report);
    }

    private boolean canViewShift(User user, ShiftReport report) {
        if (report.getCashier() != null && report.getCashier().getId().equals(user.getId())) {
            return true;
        }
        return accessControl.canManageBranch(user, report.getBranch());
    }

    private void assertCanViewShift(User user, ShiftReport report) throws Exception {
        if (!canViewShift(user, report)) {
            throw new AccessDeniedException("You do not have permission to view this shift report");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getAllShiftReports() {
        User current;
        try {
            current = userService.getCurrentUser();
        } catch (Exception e) {
            return Collections.emptyList();
        }

        List<ShiftReport> reports;
        if (current.getRole() == UserRole.ROLE_ADMIN) {
            reports = shiftReportRepository.findAll();
        } else if (current.getRole() == UserRole.ROLE_BRANCH_CASHIER) {
            reports = shiftReportRepository.findByCashierId(current.getId());
        } else if (current.getRole() == UserRole.ROLE_BRANCH_MANAGER) {
            if (current.getBranch() == null) {
                return Collections.emptyList();
            }
            reports = shiftReportRepository.findByBranchId(current.getBranch().getId());
        } else {
            Store store = accessControl.resolveStoreOfUser(current);
            if (store == null) {
                return Collections.emptyList();
            }
            reports = shiftReportRepository.findByBranchStoreId(store.getId());
        }

        return reports.stream()
                .filter(r -> canViewShift(current, r))
                .map(this::toSummaryOrLiveDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getShiftReportsByBranchId(Long branchId) {
        User current;
        try {
            current = userService.getCurrentUser();
        } catch (Exception e) {
            return Collections.emptyList();
        }
        List<ShiftReport> reports = shiftReportRepository.findByBranchId(branchId);
        return reports.stream()
                .filter(r -> canViewShift(current, r))
                .map(this::toSummaryOrLiveDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftReportDTO> getShiftReportsByCashierId(Long cashierId) {
        User current;
        try {
            current = userService.getCurrentUser();
        } catch (Exception e) {
            return Collections.emptyList();
        }
        List<ShiftReport> reports = shiftReportRepository.findByCashierId(cashierId);
        return reports.stream()
                .filter(r -> canViewShift(current, r))
                .map(this::toSummaryOrLiveDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO endShift(Long shiftReportId, LocalDateTime shiftEnd) throws Exception {
        User currentUser = userService.getCurrentUser();

        ShiftReport shiftReport;
        if (shiftReportId != null) {
            shiftReport = shiftReportRepository.findById(shiftReportId)
                    .orElseThrow(() -> new Exception("Shift not found with id: " + shiftReportId));
            assertCanViewShift(currentUser, shiftReport);
        } else {
            shiftReport = shiftReportRepository
                    .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(currentUser)
                    .orElseThrow(() -> new Exception("Shift not found"));
        }

        if (shiftReport.getShiftEnd() != null) {
            return buildPopulatedDTO(shiftReport);
        }

        LocalDateTime actualEnd = shiftEnd != null ? shiftEnd : LocalDateTime.now();
        shiftReport.setShiftEnd(actualEnd);

        List<Refund> refunds = fetchShiftRefunds(shiftReport);
        double totalRefunds = refunds.stream()
                .mapToDouble(refund -> refund.getAmount() != null ? refund.getAmount() : 0.0)
                .sum();

        List<Order> orders = fetchShiftOrders(shiftReport, actualEnd);
        List<Order> completedOrders = filterValidSalesOrders(orders);
        double totalSales = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();

        int totalOrders = completedOrders.size();
        double netSales = computeNetSales(totalSales, totalRefunds);

        shiftReport.setTotalRefunds(totalRefunds);
        shiftReport.setTotalSales(totalSales);
        shiftReport.setTotalOrders(totalOrders);
        shiftReport.setNetSale(netSales);
        shiftReport.setRecentOrders(getRecentOrders(orders));
        shiftReport.setTopSellingProducts(getTopSellingProducts(orders));
        shiftReport.setPaymentSummaries(getPaymentSummaries(orders));

        ShiftReport savedReport = shiftReportRepository.save(shiftReport);
        ShiftReportDTO dto = ShiftReportMapper.toDTO(savedReport);
        dto.setRefunds(refunds.stream().map(RefundMapper::toDTO).collect(Collectors.toList()));
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ShiftReportDTO getCurrentShiftProgress(Long cashierId) throws Exception {
        User targetCashier = userService.getCurrentUser();
        if (cashierId != null && !cashierId.equals(targetCashier.getId())) {
            User requested = userRepository.findById(cashierId).orElseThrow(() -> new Exception("Cashier not found"));
            accessControl.assertCanManageBranch(targetCashier, requested.getBranch());
            targetCashier = requested;
        }

        ShiftReport shiftReport = shiftReportRepository
                .findTopByCashierAndShiftEndIsNullOrderByShiftStartDesc(targetCashier)
                .orElseThrow(() -> new Exception("no active shift found for cashier"));

        LocalDateTime now = LocalDateTime.now();

        List<Order> orders = fetchShiftOrders(shiftReport, now);
        List<Refund> refunds = fetchShiftRefunds(shiftReport);

        double totalRefunds = refunds.stream()
                .mapToDouble(refund -> refund.getAmount() != null ? refund.getAmount() : 0.0)
                .sum();

        List<Order> completedOrders = filterValidSalesOrders(orders);
        double totalSales = completedOrders.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0.0)
                .sum();

        int totalOrders = completedOrders.size();
        double netSales = computeNetSales(totalSales, totalRefunds);

        shiftReport.setTotalRefunds(totalRefunds);
        shiftReport.setTotalSales(totalSales);
        shiftReport.setTotalOrders(totalOrders);
        shiftReport.setNetSale(netSales);
        shiftReport.setRecentOrders(getRecentOrders(orders));
        shiftReport.setTopSellingProducts(getTopSellingProducts(orders));
        shiftReport.setPaymentSummaries(getPaymentSummaries(orders));

        ShiftReport savedReport = shiftReportRepository.save(shiftReport);
        ShiftReportDTO dto = ShiftReportMapper.toDTO(savedReport);
        dto.setRefunds(refunds.stream().map(RefundMapper::toDTO).collect(Collectors.toList()));
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteShiftReport(Long id) throws Exception {
        ShiftReport report = shiftReportRepository.findById(id)
                .orElseThrow(() -> new Exception("shift report not found with given id " + id));
        accessControl.assertCanManageBranch(userService.getCurrentUser(), report.getBranch());
        List<Refund> linkedRefunds = refundRepository.findByShiftReportId(report.getId());
        for (Refund r : linkedRefunds) {
            r.setShiftReport(null);
            refundRepository.save(r);
        }
        shiftReportRepository.delete(report);
    }

    @Override
    @Transactional(readOnly = true)
    public ShiftReportDTO getShiftByCashierAndDate(Long cashierId, LocalDateTime date) throws Exception {
        User cashier = userRepository.findById(cashierId).orElseThrow(
                () -> new Exception("cashier not found with id " + cashierId)
        );
        LocalDateTime start = date.toLocalDate().atStartOfDay();
        LocalDateTime end = date.toLocalDate().atTime(LocalTime.MAX);

        ShiftReport report = shiftReportRepository.findTopByCashierAndShiftStartBetweenOrderByShiftStartDesc(
                cashier, start, end
        ).orElseThrow(() -> new Exception("shift not found for date"));
        assertCanViewShift(userService.getCurrentUser(), report);

        return buildPopulatedDTO(report);
    }
}
