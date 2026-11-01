import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Separator } from "../../../components/ui/separator";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/use-toast";
import {
  selectDiscount,
  selectDiscountAmount,
  selectSubtotal,
  selectTax,
  selectTaxRate,
  selectTotal,
  selectCouponCode,
  selectSelectedCustomer,
  setDiscount,
  setCouponCode,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import { applyCoupon } from "../../../Redux Toolkit/features/coupon/couponThunks";
import { X, Star } from "lucide-react";

const VND_PER_POINT_REDEEMED = 1000;

const CartSummary = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const subtotal = useSelector(selectSubtotal);
  const tax = useSelector(selectTax);
  const taxRate = useSelector(selectTaxRate);
  const discount = useSelector(selectDiscount);
  const discountAmount = useSelector(selectDiscountAmount);
  const total = useSelector(selectTotal);
  const appliedCouponCode = useSelector(selectCouponCode);
  const selectedCustomer = useSelector(selectSelectedCustomer);
  const { branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const isRedeemingPoints = appliedCouponCode === "POINTS";

  useEffect(() => {
    if (!appliedCouponCode) return;

    if (subtotal <= 0) {
      dispatch(setDiscount({ type: "percentage", value: 0 }));
      dispatch(setCouponCode(null));
      return;
    }

    if (appliedCouponCode === "POINTS") {
      const availablePoints = Number(selectedCustomer?.loyaltyPoints || 0);
      if (
        !selectedCustomer ||
        availablePoints <= 0 ||
        subtotal < VND_PER_POINT_REDEEMED
      ) {
        dispatch(setDiscount({ type: "percentage", value: 0 }));
        dispatch(setCouponCode(null));
      }
      return;
    }

    const minOrderVal = Number(discount?.minOrderValue || 0);
    if (minOrderVal > 0 && subtotal < minOrderVal) {
      dispatch(setDiscount({ type: "percentage", value: 0 }));
      dispatch(setCouponCode(null));
      toast({
        title: "Coupon Removed",
        description: `Order subtotal dropped below minimum ₫${minOrderVal.toLocaleString("vi-VN")} required for coupon '${appliedCouponCode}'.`,
        variant: "destructive",
      });
    }
  }, [
    subtotal,
    appliedCouponCode,
    discount?.minOrderValue,
    selectedCustomer,
    dispatch,
    toast,
  ]);

  const handleApplyCoupon = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    // Nếu thu ngân gõ trực tiếp "POINTS" vào ô mã giảm giá
    if (trimmed === "POINTS") {
      if (!selectedCustomer) {
        toast({
          title: "Chưa chọn khách hàng",
          description: "Vui lòng chọn khách hàng trước khi dùng điểm thưởng.",
          variant: "destructive",
        });
        return;
      }
      const availablePoints = Number(selectedCustomer.loyaltyPoints || 0);
      if (availablePoints <= 0) {
        toast({
          title: "Không có điểm tích lũy",
          description: "Khách hàng này hiện chưa có điểm tích lũy để quy đổi.",
          variant: "destructive",
        });
        return;
      }
      const maxUsablePoints = Math.min(
        availablePoints,
        Math.floor(subtotal / VND_PER_POINT_REDEEMED),
      );
      if (maxUsablePoints <= 0) {
        toast({
          title: "Đơn hàng chưa đủ điều kiện",
          description: "Tổng tiền hàng phải từ 1.000₫ trở lên để đổi điểm.",
          variant: "destructive",
        });
        return;
      }
      const redeemableAmount = maxUsablePoints * VND_PER_POINT_REDEEMED;
      dispatch(setDiscount({ type: "fixed", value: redeemableAmount }));
      dispatch(setCouponCode("POINTS"));
      setCode("");
      toast({
        title: "Đã áp dụng điểm tích lũy!",
        description: `Đã quy đổi ${maxUsablePoints} điểm (-${redeemableAmount.toLocaleString("vi-VN")}₫)`,
      });
      return;
    }

    const storeId = branch?.storeId || store?.id;
    if (!storeId) {
      toast({
        title: "Error",
        description: "Store ID not found.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const coupon = await dispatch(
        applyCoupon({ code: trimmed, storeId }),
      ).unwrap();

      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        toast({
          title: "Minimum Order Not Met",
          description: `This coupon requires a minimum order of ₫${coupon.minOrderValue.toLocaleString("vi-VN")}`,
          variant: "destructive",
        });
        return;
      }

      dispatch(
        setDiscount({
          type:
            coupon.discountType?.toUpperCase() === "PERCENTAGE"
              ? "percentage"
              : "fixed",
          value: coupon.discountValue,
          minOrderValue: coupon.minOrderValue || 0,
        }),
      );
      dispatch(setCouponCode(coupon.code));
      setCode("");
      toast({ title: "Success", description: "Coupon applied successfully!" });
    } catch (err) {
      toast({
        title: "Invalid Coupon",
        description: err || "Failed to apply coupon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    dispatch(setDiscount({ type: "percentage", value: 0 }));
    dispatch(setCouponCode(null));
  };

  return (
    <div className="border-t bg-muted p-4">
      <div className="space-y-4 text-sm">
        {/* Coupon Section */}
        <div className="flex gap-2">
          <Input
            placeholder={
              isRedeemingPoints ? "Đang đổi điểm tích lũy" : "Enter coupon code"
            }
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={loading || !!appliedCouponCode}
          />
          <Button
            variant={appliedCouponCode ? "destructive" : "secondary"}
            onClick={appliedCouponCode ? handleRemoveCoupon : handleApplyCoupon}
            disabled={loading || (!code.trim() && !appliedCouponCode)}
          >
            {appliedCouponCode ? <X className="w-4 h-4" /> : "Apply"}
          </Button>
        </div>
        {appliedCouponCode && (
          <div
            className={`text-xs font-medium flex items-center gap-1.5 ${
              isRedeemingPoints ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {isRedeemingPoints ? (
              <>
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>
                  Đang dùng điểm tích lũy (Giảm{" "}
                  {discountAmount.toLocaleString("vi-VN")}₫)
                </span>
              </>
            ) : (
              <span>Coupon &apos;{appliedCouponCode}&apos; applied!</span>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₫{subtotal.toLocaleString("vi-VN")}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax ({taxRate}% VAT):</span>
            <span>₫{tax.toLocaleString("vi-VN")}</span>
          </div>
          <div className="flex justify-between">
            <span>{isRedeemingPoints ? "Point Redemption:" : "Discount:"}</span>
            <span className="text-red-600 font-medium">
              - ₫{discountAmount.toLocaleString("vi-VN")}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="text-green-600">
              ₫{Number(total || 0).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartSummary;
