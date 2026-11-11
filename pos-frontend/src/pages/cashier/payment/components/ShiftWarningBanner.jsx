import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, PlayCircle } from "lucide-react";

const ShiftWarningBanner = ({ startingShift, onQuickStartShift }) => {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Chưa bắt đầu ca làm việc</div>
          <div className="opacity-90">
            Bấm mở ca ngay tại đây để hệ thống ghi nhận doanh thu ca của bạn.
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onQuickStartShift}
        disabled={startingShift}
        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs"
      >
        {startingShift ? (
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
        ) : (
          <PlayCircle className="w-3.5 h-3.5 mr-1" />
        )}
        Mở ca ngay
      </Button>
    </div>
  );
};

export default ShiftWarningBanner;
