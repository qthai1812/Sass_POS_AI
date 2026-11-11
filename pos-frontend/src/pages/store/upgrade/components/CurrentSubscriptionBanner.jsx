import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

const CurrentSubscriptionBanner = ({
  subscription,
  canManageBilling,
  actionLoading,
  onCancel,
}) => {
  if (!subscription) return null;

  return (
    <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-foreground flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
        <div>
          <div className="font-semibold">
            Gói hiện tại:{" "}
            {subscription.planName || subscription.plan?.name}
          </div>
          <div className="text-sm text-muted-foreground">
            Trạng thái: {subscription.status} | Hết hạn:{" "}
            {subscription.endDate
              ? new Date(subscription.endDate).toLocaleDateString("vi-VN")
              : "Không thời hạn"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {subscription.transactionId && (
          <Badge variant="outline" className="font-mono text-xs">
            Mã GD: {subscription.transactionId}
          </Badge>
        )}
        {canManageBilling && (
          <Button
            variant="destructive"
            size="sm"
            disabled={actionLoading}
            onClick={onCancel}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Hủy gói
          </Button>
        )}
      </div>
    </div>
  );
};

export default CurrentSubscriptionBanner;
