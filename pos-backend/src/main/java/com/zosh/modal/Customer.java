package com.zosh.modal;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
        indexes = {
                @Index(name = "idx_customer_store", columnList = "store_id")
        }
)
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    private String email;

    private String phone;

    @Builder.Default
    private Integer loyaltyPoints = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    @JsonIgnore
    private Store store;

    @Column(name = "store_id", insertable = false, updatable = false)
    @JsonIgnore
    private Long persistedStoreId;

    @Transient
    private Long storeId;

    public Long getStoreId() {
        if (store != null && org.hibernate.Hibernate.isInitialized(store)) {
            return store.getId();
        }
        return persistedStoreId != null ? persistedStoreId : storeId;
    }

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.loyaltyPoints == null) {
            this.loyaltyPoints = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
