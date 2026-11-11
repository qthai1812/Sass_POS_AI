package com.zosh.service.order;

import com.zosh.modal.Customer;
import com.zosh.modal.Order;
import com.zosh.modal.Refund;
import com.zosh.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tập trung toàn bộ quy tắc điểm tích lũy:
 * - Tích điểm: floor(totalAmount / 10,000đ)
 * - Đổi điểm: 1 điểm = 1,000đ (ghi trong couponCode dạng "POINTS (-N pts)")
 * - Thu hồi khi hoàn tiền: theo LŨY KẾ tổng tiền đã hoàn để tránh lệch làm tròn.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CustomerLoyaltyService {

    public static final double VND_PER_POINT_EARNED = 10000.0;
    public static final double VND_PER_POINT_REDEEMED = 1000.0;
    private static final Pattern POINTS_USED_PATTERN = Pattern.compile("-(\\d+)\\s*pts");

    private final CustomerRepository customerRepository;

    // ------------------------------------------------------------------ Tiện ích tính toán

    public int earnedPointsFor(double amount) {
        return (int) Math.floor(amount / VND_PER_POINT_EARNED);
    }

    /** Số điểm đã dùng để giảm giá trong đơn (được ghi trong couponCode dạng "POINTS (-N pts)"). */
    public int extractPointsUsed(Order order) {
        if (order.getCouponCode() == null || !order.getCouponCode().startsWith("POINTS")) {
            return 0;
        }
        Matcher matcher = POINTS_USED_PATTERN.matcher(order.getCouponCode());
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
    }

    // ------------------------------------------------------------------ Đơn hàng

    /**
     * Cập nhật điểm khi tạo đơn mới. Trả về Customer đã lưu (để gán lại vào Order) hoặc null nếu không thay đổi.
     */
    public Customer applyForNewOrder(Customer customer, boolean completed, double totalAmount, int pointsUsed) {
        if (customer == null) {
            return null;
        }
        int currentPoints = pointsOf(customer);
        if (completed) {
            int earnedPoints = earnedPointsFor(totalAmount);
            int updatedPoints = Math.max(0, currentPoints - pointsUsed + earnedPoints);
            customer.setLoyaltyPoints(updatedPoints);
            Customer saved = customerRepository.save(customer);
            log.info("Customer {} loyalty points updated: {} -> {} (used: {}, earned: {})",
                    customer.getId(), currentPoints, updatedPoints, pointsUsed, earnedPoints);
            return saved;
        }
        if (pointsUsed > 0) {
            customer.setLoyaltyPoints(Math.max(0, currentPoints - pointsUsed));
            return customerRepository.save(customer);
        }
        return null;
    }

    /** Cộng điểm khi đơn PENDING chuyển sang COMPLETED. */
    public void awardOnCompletion(Order order, double totalAmount) {
        if (order.getCustomer() == null) {
            return;
        }
        Customer customer = lockCustomer(order);
        customer.setLoyaltyPoints(pointsOf(customer) + earnedPointsFor(totalAmount));
        customerRepository.save(customer);
    }

    /** Trả lại điểm đã dùng (POINTS) khi hủy đơn chưa từng tích điểm. */
    public void restoreUsedPoints(Order order) {
        if (order.getCustomer() == null) {
            return;
        }
        int used = extractPointsUsed(order);
        if (used <= 0) {
            return;
        }
        Customer customer = lockCustomer(order);
        customer.setLoyaltyPoints(pointsOf(customer) + used);
        customerRepository.save(customer);
    }

    /** Hoàn lại điểm đã dùng và thu hồi phần điểm đã tích CHƯA bị khấu trừ bởi các lần hoàn tiền một phần trước đó. */
    public void revertRemaining(Order order, List<Refund> priorRefunds) {
        if (order.getCustomer() == null) {
            return;
        }
        Customer customer = lockCustomer(order);
        int currentPoints = pointsOf(customer);
        int totalEarned = earnedPointsFor(order.getTotalAmount() != null ? order.getTotalAmount() : 0.0);
        double totalRefundedAmount = priorRefunds == null ? 0.0 : priorRefunds.stream()
                .mapToDouble(r -> r.getAmount() != null ? r.getAmount() : 0.0)
                .sum();
        int alreadyDeductedByRefunds = Math.min(totalEarned, earnedPointsFor(totalRefundedAmount));
        int remainingEarnedToDeduct = Math.max(0, totalEarned - alreadyDeductedByRefunds);
        int usedToRestore = extractPointsUsed(order);
        saveIfChanged(customer, currentPoints, Math.max(0, currentPoints + usedToRestore - remainingEarnedToDeduct));
    }

    // ------------------------------------------------------------------ Phiếu hoàn

    /**
     * Thu hồi điểm đã tích & trả lại điểm đã dùng tương ứng với lần hoàn tiền mới.
     *
     * @param fullyReturned true nếu đơn đã hoàn 100% tiền hoặc khách trả hết hàng còn lại
     */
    public void applyForRefund(Order order, double orderTotal, double refundedBefore,
                               double refundedAfter, boolean fullyReturned) {
        if (order.getCustomer() == null) {
            return;
        }
        Customer customer = lockCustomer(order);
        int currentPoints = pointsOf(customer);

        int totalEarnedOnOrder = earnedPointsFor(orderTotal);
        int deductedBefore = Math.min(totalEarnedOnOrder, earnedPointsFor(refundedBefore));
        int deductedAfter = fullyReturned
                ? totalEarnedOnOrder
                : Math.min(totalEarnedOnOrder, earnedPointsFor(refundedAfter));
        int pointsToDeduct = Math.max(0, deductedAfter - deductedBefore);

        int totalUsedOnOrder = extractPointsUsed(order);
        int restoredBefore = proportionalUsedPoints(totalUsedOnOrder, orderTotal, refundedBefore);
        int restoredAfter = fullyReturned
                ? totalUsedOnOrder
                : proportionalUsedPoints(totalUsedOnOrder, orderTotal, refundedAfter);
        int pointsToRestore = Math.max(0, restoredAfter - restoredBefore);

        saveIfChanged(customer, currentPoints, Math.max(0, currentPoints + pointsToRestore - pointsToDeduct));
    }

    /** Đảo ngược điều chỉnh điểm đã thực hiện khi tạo phiếu hoàn (dùng khi xóa phiếu hoàn). */
    public void reverseForDeletedRefund(Order order, double orderTotal, double remainingRefunded,
                                        double deletedRefundAmount, boolean orderWasFullyRefunded,
                                        boolean reopenOrder) {
        if (order.getCustomer() == null) {
            return;
        }
        Customer customer = lockCustomer(order);
        int currentPoints = pointsOf(customer);
        double totalRefundedBeforeDelete = remainingRefunded + deletedRefundAmount;
        int totalEarnedOnOrder = earnedPointsFor(orderTotal);
        int deductedBeforeDelete = orderWasFullyRefunded
                ? totalEarnedOnOrder
                : Math.min(totalEarnedOnOrder, earnedPointsFor(totalRefundedBeforeDelete));
        int deductedAfterDelete = Math.min(totalEarnedOnOrder, earnedPointsFor(remainingRefunded));
        int pointsDeductedBefore = Math.max(0, deductedBeforeDelete - deductedAfterDelete);
        int pointsRestoredBefore = reopenOrder ? extractPointsUsed(order) : 0;
        saveIfChanged(customer, currentPoints, Math.max(0, currentPoints - pointsRestoredBefore + pointsDeductedBefore));
    }

    // ------------------------------------------------------------------ Nội bộ

    private int proportionalUsedPoints(int totalUsed, double orderTotal, double refunded) {
        if (orderTotal <= 0 || totalUsed <= 0) {
            return 0;
        }
        return Math.min(totalUsed, (int) Math.floor(totalUsed * (refunded / orderTotal)));
    }

    private Customer lockCustomer(Order order) {
        return customerRepository.findByIdWithLock(order.getCustomer().getId()).orElse(order.getCustomer());
    }

    private int pointsOf(Customer customer) {
        return customer.getLoyaltyPoints() != null ? customer.getLoyaltyPoints() : 0;
    }

    private void saveIfChanged(Customer customer, int currentPoints, int updatedPoints) {
        if (updatedPoints != currentPoints) {
            customer.setLoyaltyPoints(updatedPoints);
            customerRepository.save(customer);
        }
    }
}
