package com.zosh.payload.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreStatusDistributionDTO {
    private Long active;
    private Long pending;
    private Long blocked;
}
