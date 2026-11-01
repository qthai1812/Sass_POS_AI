package com.zosh.modal;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Embeddable
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorePaymentInfo {

    @Builder.Default
    private Boolean acceptCash = true;

    @Builder.Default
    private Boolean acceptMomo = true;

    @Builder.Default
    private Boolean acceptCard = true;

    // Thông tin nhận tiền Ví điện tử MoMo (QR)
    private String momoPhone;
    private String momoOwnerName;
    private String momoQrImage;

    // Thông tin nhận tiền Thẻ Visa / Ghi nợ / Tài khoản ngân hàng
    private String cardBankName;
    private String cardNumber;
    private String cardHolderName;
    private String cardExpiry;
}
