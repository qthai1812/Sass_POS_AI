import React from "react";
import { Separator } from "@/components/ui/separator";
import { formatVnd } from "@/utils/paymentGatewayUtils";

const PaymentAmountSummary = ({
  itemCount,
  subTotal,
  taxAmount,
  taxRate = 10,
  discountAmount,
  isRedeemingPoints,
  pointsUsed,
  couponCode,
  total,
}) => {
  return (
    <div className="rounded-lg bg-muted/60 p-3 space-y-1.5 border text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Tạm tính ({itemCount} mặt hàng):</span>
        <span>{formatVnd(subTotal)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Thuế VAT ({taxRate}%):</span>
        <span>{formatVnd(taxAmount)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between text-red-600 font-medium">
          <span>
            Giảm giá{" "}
            {isRedeemingPoints
              ? `(Đổi ${pointsUsed} điểm)`
              : couponCode
                ? `(${couponCode})`
                : ""}
            :
          </span>
          <span>-{formatVnd(discountAmount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between items-center text-base font-bold pt-0.5">
        <span>Tổng thanh toán:</span>
        <span className="text-xl text-emerald-600">{formatVnd(total)}</span>
      </div>
    </div>
  );
};

export default PaymentAmountSummary;
