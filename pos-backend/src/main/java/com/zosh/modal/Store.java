package com.zosh.modal;

import com.zosh.domain.StoreStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false)
    private String brand;

    @OneToOne
    private User storeAdmin;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String description;

    private String storeType;

    @Enumerated(EnumType.STRING)
    private StoreStatus status;

    private Double commissionRate = 2.5;

    private String currency = "VND";

    private Double taxRate = 10.0;

    private String timezone = "Asia/Ho_Chi_Minh";

    private String dateFormat = "DD/MM/YYYY";

    private String receiptFooter;

    @Embedded
    private StoreContact contact = new StoreContact();

    @Embedded
    private StorePaymentInfo paymentInfo = new StorePaymentInfo();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = StoreStatus.PENDING;
        }
        if (commissionRate == null) {
            commissionRate = 2.5;
        }
        if (paymentInfo == null) {
            paymentInfo = new StorePaymentInfo();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
