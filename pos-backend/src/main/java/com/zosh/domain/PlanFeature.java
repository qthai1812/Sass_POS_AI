package com.zosh.domain;

import com.zosh.modal.SubscriptionPlan;

import java.util.function.Function;

/**
 * Danh sách tính năng CỐ ĐỊNH của gói cước. Super Admin chỉ bật/tắt các tính năng này cho từng gói,
 * không tạo thêm tính năng mới. Mỗi tính năng ánh xạ tới một cờ boolean trong {@link SubscriptionPlan}.
 */
public enum PlanFeature {
    ADVANCED_REPORTS("advancedReports", "Advanced Reports", SubscriptionPlan::getAdvancedReports),
    INVENTORY("inventory", "Inventory System", SubscriptionPlan::getInventory),
    INTEGRATIONS("integrations", "Integrations", SubscriptionPlan::getIntegrations),
    ECOMMERCE("ecommerce", "eCommerce", SubscriptionPlan::getEcommerce),
    INVOICE_BRANDING("invoiceBranding", "Invoice Branding", SubscriptionPlan::getInvoiceBranding),
    PRIORITY_SUPPORT("prioritySupport", "Priority Support", SubscriptionPlan::getPrioritySupport),
    MULTI_LOCATION("multiLocation", "Multi-location", SubscriptionPlan::getMultiLocation);

    private final String key;
    private final String label;
    private final Function<SubscriptionPlan, Boolean> reader;

    PlanFeature(String key, String label, Function<SubscriptionPlan, Boolean> reader) {
        this.key = key;
        this.label = label;
        this.reader = reader;
    }

    public String getKey() {
        return key;
    }

    public String getLabel() {
        return label;
    }

    /** Gói có bật tính năng này hay không (giá trị null được xem là tắt). */
    public boolean isEnabledIn(SubscriptionPlan plan) {
        return plan != null && Boolean.TRUE.equals(reader.apply(plan));
    }
}
