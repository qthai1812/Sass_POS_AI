package com.zosh.payload.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardSummaryDTO {
    private Long totalStores;
    private Long activeStores;
    private Long pendingStores;
    private Long blockedStores;
}
