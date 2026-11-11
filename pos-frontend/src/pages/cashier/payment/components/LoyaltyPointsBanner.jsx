import React from "react";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, Star, User } from "lucide-react";
import { VND_PER_POINT_REDEEMED } from "../paymentDialogUtils";

const LoyaltyPointsBanner = ({
  customer,
  availablePoints,
  pointsUsed,
  earnedPoints,
  projectedPoints,
}) => {
  if (!customer) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold flex items-center gap-1.5 text-foreground">
          <User className="w-3.5 h-3.5 text-emerald-600" />
          {customer.fullName || customer.name}
        </span>
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1"
        >
          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
          Hiện có: {availablePoints} điểm
        </Badge>
      </div>

      {pointsUsed > 0 && (
        <div className="flex justify-between text-red-600 font-medium">
          <span className="flex items-center gap-1">
            <Gift className="w-3 h-3" />
            Điểm sử dụng đơn này:
          </span>
          <span>
            -{pointsUsed} điểm (-
            {(pointsUsed * VND_PER_POINT_REDEEMED).toLocaleString("vi-VN")}
            ₫)
          </span>
        </div>
      )}

      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Điểm tích lũy thêm:
        </span>
        <span>+{earnedPoints} điểm</span>
      </div>

      <div className="flex justify-between pt-1 border-t border-amber-500/20 font-semibold text-foreground">
        <span>Số dư điểm sau thanh toán:</span>
        <span className="text-amber-600 dark:text-amber-400">
          {projectedPoints} điểm
        </span>
      </div>
    </div>
  );
};

export default LoyaltyPointsBanner;
