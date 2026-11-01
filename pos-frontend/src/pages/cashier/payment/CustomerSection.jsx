import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectSelectedCustomer,
  selectSubtotal,
  selectCouponCode,
  selectTotal,
  setDiscount,
  setCouponCode,
  setSelectedCustomer,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import { User, Star, Gift, X, Sparkles, UserCheck } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { useToast } from "../../../components/ui/use-toast";

export const VND_PER_POINT_REDEEMED = 1000; // 1 điểm = 1.000₫
export const VND_PER_POINT_EARNED = 10000; // 10.000₫ = +1 điểm

const CustomerSection = ({ setShowCustomerDialog }) => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const selectedCustomer = useSelector(selectSelectedCustomer);
  const subtotal = useSelector(selectSubtotal);
  const total = useSelector(selectTotal);
  const couponCode = useSelector(selectCouponCode);

  const availablePoints = Math.max(
    0,
    Number(selectedCustomer?.loyaltyPoints || 0),
  );
  const isRedeemingPoints = couponCode === "POINTS";

  // Số điểm tối đa có thể dùng cho đơn hàng hiện tại (không vượt quá subtotal)
  const maxUsablePoints = Math.min(
    availablePoints,
    Math.floor(Math.max(0, subtotal || 0) / VND_PER_POINT_REDEEMED),
  );
  const redeemableAmount = maxUsablePoints * VND_PER_POINT_REDEEMED;

  // Số điểm tích lũy thêm từ đơn hàng này (10.000₫ thực trả = +1 điểm)
  const estimatedEarnedPoints = Math.floor(
    Math.max(0, total || 0) / VND_PER_POINT_EARNED,
  );
  const pointsUsedNow = isRedeemingPoints ? maxUsablePoints : 0;
  const projectedBalance = Math.max(
    0,
    availablePoints - pointsUsedNow + estimatedEarnedPoints,
  );

  // Tự động cập nhật lại tiền giảm nếu giỏ hàng hoặc khách hàng thay đổi khi đang bật đổi điểm
  useEffect(() => {
    if (isRedeemingPoints) {
      if (!selectedCustomer || maxUsablePoints <= 0) {
        dispatch(setDiscount({ type: "percentage", value: 0 }));
        dispatch(setCouponCode(null));
      } else {
        dispatch(
          setDiscount({
            type: "fixed",
            value: maxUsablePoints * VND_PER_POINT_REDEEMED,
          }),
        );
      }
    }
  }, [
    subtotal,
    selectedCustomer,
    isRedeemingPoints,
    maxUsablePoints,
    dispatch,
  ]);

  const handleToggleRedeemPoints = () => {
    if (isRedeemingPoints) {
      dispatch(setDiscount({ type: "percentage", value: 0 }));
      dispatch(setCouponCode(null));
      toast({
        title: "Đã hủy dùng điểm",
        description: "Điểm tích lũy của khách hàng sẽ được giữ nguyên.",
      });
      return;
    }

    if (subtotal < VND_PER_POINT_REDEEMED) {
      toast({
        title: "Chưa đủ điều kiện đổi điểm",
        description: "Tổng tiền hàng phải từ 1.000₫ trở lên để quy đổi điểm.",
        variant: "destructive",
      });
      return;
    }

    dispatch(setDiscount({ type: "fixed", value: redeemableAmount }));
    dispatch(setCouponCode("POINTS"));
    toast({
      title: "Đã áp dụng điểm tích lũy!",
      description: `Đã quy đổi ${maxUsablePoints} điểm thành -${redeemableAmount.toLocaleString("vi-VN")}₫`,
    });
  };

  const handleClearCustomer = () => {
    if (isRedeemingPoints) {
      dispatch(setDiscount({ type: "percentage", value: 0 }));
      dispatch(setCouponCode(null));
    }
    dispatch(setSelectedCustomer(null));
  };

  return (
    <div className="p-4 border-b">
      <h2 className="text-lg font-semibold mb-3 flex items-center justify-between">
        <span className="flex items-center">
          <User className="w-5 h-5 mr-2" />
          Customer
        </span>
        {selectedCustomer && (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            {availablePoints} điểm
          </Badge>
        )}
      </h2>

      {selectedCustomer ? (
        <Card className="border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/40 dark:border-emerald-800 shadow-xs py-0">
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 truncate flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {selectedCustomer.fullName || selectedCustomer.name}
                  </span>
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {selectedCustomer.phone || "Chưa có SĐT"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowCustomerDialog(true)}
                >
                  Đổi KH
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={handleClearCustomer}
                  title="Bỏ chọn khách hàng"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Khung thông tin điểm thưởng & Nút Quy đổi 1 chạm */}
            <div className="rounded-lg bg-background/90 border border-amber-500/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Giá trị quy đổi:
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {(availablePoints * VND_PER_POINT_REDEEMED).toLocaleString(
                    "vi-VN",
                  )}
                  ₫
                </span>
              </div>

              {availablePoints > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant={isRedeemingPoints ? "destructive" : "default"}
                  disabled={!isRedeemingPoints && maxUsablePoints <= 0}
                  onClick={handleToggleRedeemPoints}
                  className={`w-full h-8 text-xs font-semibold ${
                    !isRedeemingPoints
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                      : ""
                  }`}
                >
                  {isRedeemingPoints ? (
                    <>
                      <X className="w-3.5 h-3.5 mr-1" />
                      Hủy dùng {maxUsablePoints} điểm (-
                      {redeemableAmount.toLocaleString("vi-VN")}₫)
                    </>
                  ) : (
                    <>
                      <Gift className="w-3.5 h-3.5 mr-1.5" />
                      {maxUsablePoints > 0
                        ? `Dùng ${maxUsablePoints} điểm (-${redeemableAmount.toLocaleString("vi-VN")}₫)`
                        : `Đổi ${availablePoints} điểm (Thêm SP trước)`}
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center py-0.5">
                  Khách hàng chưa có điểm tích lũy (10.000₫ = +1 điểm)
                </p>
              )}

              {subtotal > 0 && (
                <div className="pt-1.5 border-t border-border/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Điểm cộng đơn này:
                    </span>
                    <span className="font-bold">
                      +{estimatedEarnedPoints} điểm
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Số dư điểm sau TT:</span>
                    <span className="font-semibold text-foreground">
                      {projectedBalance} điểm
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowCustomerDialog(true)}
        >
          <User className="w-4 h-4 mr-2" />
          Select Customer (F3 / F4)
        </Button>
      )}
    </div>
  );
};

export default CustomerSection;
