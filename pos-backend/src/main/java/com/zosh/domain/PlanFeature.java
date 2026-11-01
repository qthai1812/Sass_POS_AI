package com.zosh.domain;

import com.zosh.modal.SubscriptionPlan;

import java.util.function.Function;

public enum PlanFeature {
    ADVANCED_REPORTS("advancedReports", "Advanced Reports", SubscriptionPlan::getAdvancedReports),
    INVENTORY("inventory", "Inventory System", SubscriptionPlan::getInventory),
    INTEGRATIONS("integrations", "Integrations", SubscriptionPlan::getIntegrations),
    ECOMMERCE("ecommerce", "eCommerce", SubscriptionPlan::getEcommerce),
    INVOICE_BRANDING("invoiceBranding", "Invoice Branding", SubscriptionPlan::getInvoiceBranding),
    PRIORITY_SUPPORT("prioritySupport", "Priority Support", SubscriptionPlan::getPrioritySupport),
    MULTI_LOCATION("multiLocation", "Multi-location", SubscriptionPlan::getMultiLocation),
    AI_COPILOT("aiCopilot", "AI Copilot & Smart POS", SubscriptionPlan::getAiCopilot);

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

    public boolean isEnabledIn(SubscriptionPlan plan) {
        return plan != null && Boolean.TRUE.equals(reader.apply(plan));
    }
}
