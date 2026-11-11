import React from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Info,
  ShoppingCart,
  Store,
  Users,
  XCircle,
} from "lucide-react";
import { PLAN_FEATURES } from "../upgradeUtils";

const PlanCard = ({
  plan,
  activePlan,
  hasCurrentSubscription,
  actionLoading,
  onSelectPlan,
}) => {
  return (
    <div
      className={`bg-card rounded-2xl p-8 shadow-lg border relative flex flex-col ${
        activePlan ? "ring-2 ring-primary" : ""
      }`}
    >
      {activePlan && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
            Gói đang dùng
          </span>
        </div>
      )}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
        <div className="flex items-baseline justify-center">
          <span className="text-4xl font-bold text-foreground">
            ₫{Number(plan.price || 0).toLocaleString("vi-VN")}
          </span>
          <span className="text-muted-foreground ml-1">
            /{plan.billingCycle?.toLowerCase()}
          </span>
        </div>
      </div>

      <ul className="space-y-4 mb-8">
        {plan.description && (
          <li className="text-muted-foreground mb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            {plan.description}
          </li>
        )}
        {plan.maxBranches && (
          <li className="text-muted-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-500 flex-shrink-0" />
            Tối đa Chi nhánh: {plan.maxBranches}
          </li>
        )}
        {plan.maxUsers && (
          <li className="text-muted-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
            Tối đa Nhân sự: {plan.maxUsers}
          </li>
        )}
        {plan.maxProducts && (
          <li className="text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-500 flex-shrink-0" />
            Tối đa Sản phẩm: {plan.maxProducts}
          </li>
        )}
        <li className="pt-2 border-t">
          <ul className="space-y-1.5">
            {PLAN_FEATURES.map((f) => {
              const on = Boolean(plan[f.key]);
              return (
                <li
                  key={f.key}
                  className={`flex items-center gap-2 text-sm ${
                    on
                      ? "text-foreground"
                      : "text-muted-foreground line-through opacity-60"
                  }`}
                >
                  {on ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  {f.label}
                </li>
              );
            })}
          </ul>
        </li>
      </ul>

      <Button
        className="w-full mt-auto"
        variant={activePlan ? "outline" : "default"}
        size="default"
        disabled={actionLoading || activePlan}
        onClick={() => onSelectPlan(plan)}
      >
        {activePlan
          ? "Đang sử dụng gói này"
          : hasCurrentSubscription
            ? "Nâng cấp lên gói này"
            : "Đăng ký ngay"}
      </Button>
    </div>
  );
};

export default PlanCard;
