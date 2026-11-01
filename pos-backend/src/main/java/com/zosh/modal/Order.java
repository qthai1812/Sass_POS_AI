package com.zosh.modal;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(
        name = "orders",
        indexes = {
                @Index(name = "idx_orders_branch_created", columnList = "branch_id, createdAt"),
                @Index(name = "idx_orders_cashier_created", columnList = "cashier_id, createdAt"),
                @Index(name = "idx_orders_customer", columnList = "customer_id")
        }
)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    private Double subTotal;

    private Double taxAmount;

    private Double discountAmount;

    private String couponCode;

    private Double totalAmount;

    private String note;

    private LocalDateTime createdAt;

    @ManyToOne
    private Branch branch;

    @ManyToOne
    private User cashier;

    @ManyToOne
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private List<OrderItem> items;
    @Enumerated(EnumType.STRING)
    private PaymentType paymentType;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = OrderStatus.COMPLETED;
        }
    }
}