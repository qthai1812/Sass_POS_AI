import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const QUICK_POINTS = [5, 10, 20, 50, 100];

const AddPointsDialog = ({
  isOpen,
  onClose,
  customer,
  pointsToAdd,
  onPointsChange,
  onAddPoints,
}) => {
  const currentPoints = Number(customer?.loyaltyPoints || 0);
  const added = Number(pointsToAdd || 0);
  const newTotal = Math.max(0, currentPoints + added);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cộng điểm tích lũy (Loyalty Points)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="rounded-lg bg-muted/60 p-3 space-y-1.5 text-sm border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Khách hàng:</span>
              <span className="font-semibold">
                {customer?.fullName || customer?.name || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số điện thoại:</span>
              <span>{customer?.phone || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-muted-foreground">Điểm hiện tại:</span>
              <span className="font-bold text-amber-600 flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                {currentPoints} điểm (
                {(currentPoints * 1000).toLocaleString("vi-VN")}₫)
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="points" className="text-sm font-medium block">
              Số điểm muốn cộng thêm
            </label>
            <Input
              id="points"
              type="number"
              min="1"
              placeholder="Nhập số điểm cần cộng..."
              value={pointsToAdd || ""}
              onChange={(e) =>
                onPointsChange(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_POINTS.map((pts) => (
                <Button
                  key={pts}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onPointsChange(pts)}
                >
                  +{pts} điểm
                </Button>
              ))}
            </div>
          </div>

          {added > 0 && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 flex justify-between items-center text-sm">
              <span className="font-medium text-emerald-800 dark:text-emerald-200">
                Tổng điểm sau khi cộng:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {newTotal} điểm ({(newTotal * 1000).toLocaleString("vi-VN")}₫)
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={onAddPoints} disabled={added <= 0}>
            Xác nhận cộng +{added} điểm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPointsDialog;
