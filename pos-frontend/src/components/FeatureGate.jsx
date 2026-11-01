import React from "react";
import { Link } from "react-router";
import { useSelector } from "react-redux";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";

/**
 * Chỉ hiển thị nội dung nếu gói cước hiện hành của cửa hàng bật tính năng `feature`
 * (tên cờ của gói: advancedReports, inventory, ...). Ngược lại hiển thị thông báo yêu cầu nâng cấp.
 */
export default function FeatureGate({ feature, title, children }) {
  const { hasFeature, ready, loading, entitlements } = usePlanEntitlements();
  const role = useSelector((state) => state.user?.userProfile?.role);

  if (!ready && loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (hasFeature(feature)) {
    return children;
  }

  const canUpgrade = role === "ROLE_STORE_ADMIN" || role === "ROLE_STORE_MANAGER";

  return (
    <div className="flex items-center justify-center py-16">
      <div className="max-w-md text-center space-y-4 p-8 border rounded-xl bg-card shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">{title} is not included in your plan</h2>
        <p className="text-sm text-muted-foreground">
          Your current plan{entitlements?.planName ? ` "${entitlements.planName}"` : ""} does
          not include this feature.{" "}
          {canUpgrade
            ? "Upgrade your plan to unlock it."
            : "Please ask your store admin to upgrade the plan."}
        </p>
        {canUpgrade && (
          <Button asChild>
            <Link to="/store/upgrade">View plans</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
