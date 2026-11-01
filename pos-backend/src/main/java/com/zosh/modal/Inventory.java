package com.zosh.modal;

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
    name = "inventory",
    uniqueConstraints = {
        // Đảm bảo mỗi (product, branch) chỉ có đúng một bản ghi inventory
        @UniqueConstraint(name = "uk_inventory_product_branch", columnNames = {"product_id", "branch_id"})
    }
)
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    // Low stock threshold — alert when quantity drops below this
    @Builder.Default
    private Integer minStockLevel = 10;

    private LocalDateTime lastUpdate;

    /**
     * Optimistic locking version field — Spring Data JPA sẽ tự động
     * ném OptimisticLockException nếu hai thread cùng sửa một row.
     * Kết hợp với pessimistic lock (PESSIMISTIC_WRITE) trong repository
     * để bảo vệ tối đa khỏi race condition.
     */
    @Version
    @Column(nullable = false)
    private Long version;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        lastUpdate = LocalDateTime.now();
    }
}
