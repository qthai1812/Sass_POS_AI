package com.zosh.modal;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Mã OTP 6 chữ số hoặc Reset Ticket
    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "otp_code", length = 6)
    private String otpCode;

    // Reset Ticket ngắn hạn cấp sau khi verify OTP thành công (Bước 4 -> Bước 5)
    @Column(name = "reset_ticket", unique = true)
    private String resetTicket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean otpVerified = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean used = false;

    // Đếm số lần nhập sai OTP để khóa mã khi có hành vi đáng ngờ (Brute-force)
    @Builder.Default
    @Column(nullable = false)
    private int attemptCount = 0;

    @Column(name = "request_ip", length = 64)
    private String requestIp;

    @PrePersist
    public void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiresAt);
    }
}
