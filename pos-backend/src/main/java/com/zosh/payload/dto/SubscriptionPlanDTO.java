package com.zosh.payload.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionPlanDTO {

    private Long id;
    private String name;
    private Double price;
    private String billingCycle;

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
    private List<String> extraFeatures;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
