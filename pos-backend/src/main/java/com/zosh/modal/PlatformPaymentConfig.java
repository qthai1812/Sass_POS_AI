package com.zosh.modal;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "platform_payment_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlatformPaymentConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Builder.Default
    private Boolean acceptMomo = true;

    @Builder.Default
    private Boolean acceptCard = true;

    // Thông tin nhận tiền Ví điện tử MoMo (QR) của POS Admin
    private String momoPhone;
    private String momoOwnerName;
    private String momoQrImage;

    // Thông tin nhận tiền Thẻ Visa / Ghi nợ / Tài khoản ngân hàng của POS Admin
    private String cardBankName;
    private String cardNumber;
    private String cardHolderName;
    private String cardExpiry;

    private LocalDateTime updatedAt;
}
