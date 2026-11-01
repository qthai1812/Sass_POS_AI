package com.zosh.modal;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(nullable = false)
    private String name;

    private Double price;
    private String billingCycle; // MONTHLY, YEARLY

    private Integer maxBranches;
    private Integer maxUsers;
    private Integer maxProducts;

    private Boolean active;

    // Feature flags
    private Boolean advancedReports;
    private Boolean inventory;
    private Boolean integrations;
    private Boolean ecommerce;
    private Boolean invoiceBranding;
    private Boolean prioritySupport;
    private Boolean multiLocation;

    private String description;

    @ElementCollection
    private List<String> extraFeatures;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (active == null) active = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
