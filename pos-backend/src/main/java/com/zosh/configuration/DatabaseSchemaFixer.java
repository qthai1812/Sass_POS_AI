package com.zosh.configuration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Automatically repairs legacy ordinal CHECK constraints and corrupted MySQL ENUM values
 * left behind when columns were migrated from @Enumerated(ORDINAL) to @Enumerated(STRING).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseSchemaFixer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            dropLegacyCheckConstraints();
            repairEnumColumnsAndValues();
            backfillUserStoreIds();
            backfillCustomerStoreIds();
        } catch (Exception e) {
            log.warn("DatabaseSchemaFixer encountered a non-fatal warning: {}", e.getMessage());
        }
    }

    private void dropLegacyCheckConstraints() {
        String sql = """
                SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME
                FROM information_schema.TABLE_CONSTRAINTS tc
                JOIN information_schema.CHECK_CONSTRAINTS cc
                  ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
                 AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
                WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
                  AND cc.CHECK_CLAUSE LIKE '%between 0 and%'
                """;
        List<Map<String, Object>> constraints = jdbcTemplate.queryForList(sql);
        for (Map<String, Object> row : constraints) {
            String tableName = String.valueOf(row.get("TABLE_NAME"));
            String constraintName = String.valueOf(row.get("CONSTRAINT_NAME"));
            try {
                jdbcTemplate.execute("ALTER TABLE `" + tableName + "` DROP CHECK `" + constraintName + "`");
                log.info("Dropped legacy ordinal CHECK constraint {}.{}", tableName, constraintName);
            } catch (Exception ex) {
                log.debug("Could not drop check constraint {}.{}: {}", tableName, constraintName, ex.getMessage());
            }
        }
    }

    private void repairEnumColumnsAndValues() {
        String[] varcharMigrations = {
                "ALTER TABLE `orders` MODIFY COLUMN `status` VARCHAR(32) DEFAULT 'COMPLETED'",
                "ALTER TABLE `orders` MODIFY COLUMN `payment_type` VARCHAR(32) DEFAULT 'CASH'",
                "ALTER TABLE `refund` MODIFY COLUMN `payment_type` VARCHAR(32) DEFAULT 'CASH'",
                "ALTER TABLE `store` MODIFY COLUMN `status` VARCHAR(32) DEFAULT 'PENDING'",
                "ALTER TABLE `subscription` MODIFY COLUMN `status` VARCHAR(32)",
                "ALTER TABLE `subscription` MODIFY COLUMN `gateway` VARCHAR(32)",
                "ALTER TABLE `user` MODIFY COLUMN `role` VARCHAR(32)"
        };
        for (String ddl : varcharMigrations) {
            try {
                jdbcTemplate.execute(ddl);
            } catch (Exception ex) {
                log.debug("Could not execute schema migration [{}]: {}", ddl, ex.getMessage());
            }
        }

        jdbcTemplate.update("UPDATE `user` SET `role` = 'ROLE_ADMIN' WHERE (`role` = '' OR `role` IS NULL) AND `email` = 'admin@pos.com'");

        try {
            jdbcTemplate.execute("ALTER TABLE `user` ADD COLUMN `login_access` BIT(1) DEFAULT b'1'");
        } catch (Exception ex) {
            log.debug("user.login_access column already exists: {}", ex.getMessage());
        }
        try {
            jdbcTemplate.update("UPDATE `user` SET `login_access` = 1 WHERE `login_access` IS NULL");
        } catch (Exception ex) {
            log.debug("Could not update user.login_access: {}", ex.getMessage());
        }
        jdbcTemplate.update("UPDATE `store` SET `status` = 'ACTIVE' WHERE `status` = '' OR `status` IS NULL");
        jdbcTemplate.update("UPDATE `store` SET `commission_rate` = 2.5 WHERE `commission_rate` IS NULL");
        jdbcTemplate.update("UPDATE `orders` SET `payment_type` = 'CASH' WHERE `payment_type` = '' OR `payment_type` IS NULL");
        jdbcTemplate.update("UPDATE `orders` SET `status` = 'COMPLETED' WHERE `status` = '' OR `status` IS NULL");
        jdbcTemplate.update("UPDATE `refund` SET `payment_type` = 'CASH' WHERE `payment_type` = '' OR `payment_type` IS NULL");
    }

    private void backfillUserStoreIds() {
        try {
            jdbcTemplate.update("""
                    UPDATE `user` u
                    JOIN `branch` b ON u.branch_id = b.id
                    SET u.store_id = b.store_id
                    WHERE u.store_id IS NULL AND b.store_id IS NOT NULL
                    """);
        } catch (Exception ex) {
            log.debug("Could not backfill user.store_id from branch: {}", ex.getMessage());
        }
        try {
            jdbcTemplate.update("""
                    UPDATE `user` u
                    JOIN `store` s ON s.store_admin_id = u.id
                    SET u.store_id = s.id
                    WHERE u.store_id IS NULL
                    """);
        } catch (Exception ex) {
            log.debug("Could not backfill user.store_id from store_admin_id: {}", ex.getMessage());
        }
    }

    private void backfillCustomerStoreIds() {
        try {
            jdbcTemplate.update("""
                    UPDATE `customer` c
                    JOIN (
                        SELECT o.customer_id, MAX(b.store_id) AS store_id
                        FROM `orders` o
                        JOIN `branch` b ON o.branch_id = b.id
                        WHERE o.customer_id IS NOT NULL AND b.store_id IS NOT NULL
                        GROUP BY o.customer_id
                    ) obs ON c.id = obs.customer_id
                    SET c.store_id = obs.store_id
                    WHERE c.store_id IS NULL
                    """);
        } catch (Exception ex) {
            log.debug("Could not backfill customer.store_id from orders: {}", ex.getMessage());
        }
    }
}
