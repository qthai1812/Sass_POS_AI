import { maskCardTail } from "../../../utils/paymentGatewayUtils.js";

// Tính năng cố định của gói (đồng bộ với PlanFeature ở backend)
export const PLAN_FEATURES = [
  { key: "advancedReports", label: "Advanced Reports" },
  { key: "inventory", label: "Inventory System" },
  { key: "multiLocation", label: "Multi-location" },
  { key: "invoiceBranding", label: "Invoice Branding" },
  { key: "integrations", label: "Integrations" },
  { key: "ecommerce", label: "eCommerce" },
  { key: "prioritySupport", label: "Priority Support" },
  { key: "aiCopilot", label: "AI Copilot & Smart POS" },
];

export function findCurrentSubscription(subscriptions, storeId) {
  return (subscriptions || []).find(
    (sub) =>
      (sub.storeId === storeId || sub.store?.id === storeId) &&
      (sub.status === "ACTIVE" || sub.status === "TRIAL"),
  );
}

export function isPlanCurrent(currentSubscription, plan) {
  if (!currentSubscription || !plan) return false;
  return (
    String(currentSubscription.planId) === String(plan.id) ||
    currentSubscription.plan?.id === plan.id ||
    currentSubscription.planName?.toLowerCase() === plan.name?.toLowerCase()
  );
}

export function filterVisiblePlans(plans, currentSubscription) {
  return (plans || []).filter(
    (plan) => plan.active !== false || isPlanCurrent(currentSubscription, plan),
  );
}

// Không cho chọn gói có giới hạn thấp hơn mức cửa hàng đang dùng (tránh thanh toán rồi mới bị từ chối)
export function getSwitchBlocker(plan, entitlements) {
  if (!entitlements || !plan) return null;
  if (plan.maxBranches > 0 && entitlements.usedBranches > plan.maxBranches) {
    return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxBranches} chi nhánh nhưng cửa hàng đang có ${entitlements.usedBranches}. Hãy xóa bớt chi nhánh trước.`;
  }
  if (!plan.multiLocation && entitlements.usedBranches > 1) {
    return `Gói "${plan.name}" không có Multi-location (chỉ 1 chi nhánh) nhưng cửa hàng đang có ${entitlements.usedBranches} chi nhánh.`;
  }
  if (plan.maxUsers > 0 && entitlements.usedUsers > plan.maxUsers) {
    return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxUsers} nhân sự nhưng cửa hàng đang có ${entitlements.usedUsers}. Hãy xóa bớt nhân sự trước.`;
  }
  if (plan.maxProducts > 0 && entitlements.usedProducts > plan.maxProducts) {
    return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxProducts} sản phẩm nhưng cửa hàng đang có ${entitlements.usedProducts}. Hãy xóa bớt sản phẩm trước.`;
  }
  return null;
}

export function resolvePlatformPaymentDisplay(platformConfig) {
  const platformMomoPhone =
    platformConfig?.momoPhone?.trim() || "0901234567";
  const platformMomoOwner =
    platformConfig?.momoOwnerName?.trim() || "POS PRO ENTERPRISE SAAS";
  const platformBankName =
    platformConfig?.cardBankName?.trim() || "Vietcombank - Visa";
  const platformCardHolder =
    platformConfig?.cardHolderName?.trim() || platformMomoOwner;
  const platformCardMasked = maskCardTail(
    platformConfig?.cardNumber,
    "Cổng Visa/Mastercard POS Admin",
  );

  const rawPlatformCard = platformConfig?.cardNumber?.trim() || "";
  const safeBankAccount =
    rawPlatformCard &&
    !rawPlatformCard.includes("•") &&
    !rawPlatformCard.includes("*")
      ? rawPlatformCard
      : platformMomoPhone;

  return {
    platformMomoPhone,
    platformMomoOwner,
    platformBankName,
    platformCardHolder,
    platformCardMasked,
    safeBankAccount,
  };
}

export function normalizeSubscriptionGateway(paymentMethod) {
  if (paymentMethod === "MOMO") return "MOMO";
  if (paymentMethod === "VISA") return "VISA";
  return "RAZORPAY";
}
