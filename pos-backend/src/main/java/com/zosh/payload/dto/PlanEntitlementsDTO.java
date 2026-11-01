package com.zosh.payload.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Quyền lợi hiện hành của một cửa hàng theo gói đang ACTIVE: giới hạn, mức đã dùng và các tính năng được bật.
 * Cửa hàng chưa có gói ACTIVE còn hạn: {@code subscribed = false}, mọi tính năng bật và không giới hạn.
 */
@Data
@NoArgsConstructor
public class PlanEntitlementsDTO {
    private Long storeId;
    private String storeName;
    private boolean subscribed;
    private String planId;
    private String planName;
    private LocalDateTime endDate;

    /** null = không giới hạn */
    private Integer maxBranches;
    private Integer maxUsers;
    private Integer maxProducts;

    private long usedBranches;
    private long usedUsers;
    private long usedProducts;

    /** key = tên cờ trong gói (advancedReports, inventory, ...) */
    private Map<String, Boolean> features;
}
