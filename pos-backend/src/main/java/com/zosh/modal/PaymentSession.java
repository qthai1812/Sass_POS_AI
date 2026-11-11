package com.zosh.modal;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(
        name = "payment_sessions",
        indexes = {
                @Index(name = "idx_payment_sessions_transfer_content", columnList = "transferContent"),
                @Index(name = "idx_payment_sessions_order_id", columnList = "orderId"),
                @Index(name = "idx_payment_sessions_subscription_id", columnList = "subscriptionId")
        }
)
public class PaymentSession {

    @Id
    @Column(length = 64)
    private String sessionId;

    private Double amount;

    @Column(length = 32)
    private String provider;

    @Column(length = 64)
    private String description;

    @Column(length = 32)
    private String status;

    @Column(length = 128)
    private String transactionId;

    @Column(length = 16)
    private String maskedCardNumber;

    @Column(length = 128)
    private String cardHolderName;

    @Column(length = 64)
    private String cardBrand;

    @Column(length = 64)
    private String approvalCode;

    @Column(length = 128)
    private String recipientBank;

    @Column(length = 64)
    private String recipientAccount;

    @Column(length = 128)
    private String recipientName;

    @Column(length = 64)
    private String transferContent;

    @Column(length = 1024)
    private String vietQrImageUrl;

    @Column(length = 255)
    private String failureReason;

    @Column(length = 64)
    private String webhookToken;

    @Column(length = 128, unique = true)
    private String providerTxId;

    private Long storeId;

    @Column(length = 64)
    private String planId;

    private Long createdByUserId;

    private Long orderId;

    private Long subscriptionId;

    private LocalDateTime createdAt;

    private LocalDateTime expiresAt;

    private LocalDateTime completedAt;

    @Builder.Default
    private boolean consumed = false;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.status == null) {
            this.status = "PENDING";
        }
    }
}
