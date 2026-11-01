package com.zosh.modal;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Table(
        name = "coupons",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_coupon_store_code", columnNames = {"store_id", "code"})
        }
)
public class Coupon {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false)
    private String code;

    // "PERCENTAGE" or "FLAT"
    @Column(nullable = false)
    private String discountType;

    @Column(nullable = false)
    private Double discountValue;

    private Double minOrderValue;

    private LocalDateTime validFrom;
    private LocalDateTime validUntil;

    private Boolean isActive;

    @ManyToOne
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;
}
