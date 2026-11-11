import React from "react";
import { Input } from "@/components/ui/input";
import { formatVnd } from "@/utils/paymentGatewayUtils";
import { getCashQuickPresets } from "../paymentDialogUtils";

const CashPaymentSection = ({
  total,
  cashReceived,
  onCashReceivedChange,
  numericCashReceived,
  changeAmount,
}) => {
  const presets = getCashQuickPresets(total);
  const exactTotal = Math.ceil(total || 0);

  return (
    <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2.5">
      <label className="text-xs font-semibold text-muted-foreground block">
        Tiền mặt khách đưa (Nhập hoặc chọn nhanh mệnh giá)
      </label>
      <Input
        type="number"
        min="0"
        placeholder={`Nhập số tiền khách đưa (≥ ${Number(total || 0).toLocaleString("vi-VN")}₫)`}
        value={cashReceived}
        onChange={(e) => onCashReceivedChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onCashReceivedChange(String(preset))}
            className="text-xs px-2.5 py-1 rounded-md border bg-background hover:bg-emerald-500/10 hover:border-emerald-500/40 font-medium transition-colors"
          >
            {preset === exactTotal
              ? "Đủ tiền"
              : `${(preset / 1000).toLocaleString("vi-VN")}k`}
          </button>
        ))}
      </div>
      {numericCashReceived >= total && total > 0 && (
        <div className="flex justify-between items-center text-sm font-bold text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
          <span>Tiền thừa trả khách:</span>
          <span>{formatVnd(changeAmount)}</span>
        </div>
      )}
    </div>
  );
};

export default CashPaymentSection;
