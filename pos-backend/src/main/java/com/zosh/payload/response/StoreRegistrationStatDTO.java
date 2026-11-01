package com.zosh.payload.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreRegistrationStatDTO {
    private String date;
    private Long count;
}
