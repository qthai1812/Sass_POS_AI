import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectCouponCode,
  selectDiscount,
  setCouponCode,
  setDiscount,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import { Tag } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "@/components/ui/input";

const DiscountSection = ({ discountInputRef }) => {
  const dispatch = useDispatch();
  const discount = useSelector(selectDiscount);
  const couponCode = useSelector(selectCouponCode);
  const isRedeemingPoints = couponCode === "POINTS";

  const handleSetDiscount = (e) => {
    const val = Math.max(0, parseFloat(e.target.value) || 0);
    if (couponCode) {
      dispatch(setCouponCode(null));
    }
    dispatch(setDiscount({ ...discount, value: val }));
  };

  const handleChangeType = (type) => {
    if (couponCode) {
      dispatch(setCouponCode(null));
    }
    dispatch(setDiscount({ ...discount, type }));
  };

  return (
    <div className="p-4 border-b">
      <h2 className="text-lg font-semibold mb-3 flex items-center justify-between">
        <span className="flex items-center">
          <Tag className="w-5 h-5 mr-2" />
          Discount
        </span>
        {isRedeemingPoints && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Theo điểm thưởng
          </span>
        )}
      </h2>
      <div className="space-y-3">
        <Input
          ref={discountInputRef}
          type="number"
          min="0"
          placeholder="Discount amount (F2)"
          value={discount.value || ""}
          onChange={handleSetDiscount}
          disabled={isRedeemingPoints}
        />
        <div className="flex space-x-2">
          <Button
            type="button"
            variant={discount.type === "percentage" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            disabled={isRedeemingPoints}
            onClick={() => handleChangeType("percentage")}
          >
            %
          </Button>
          <Button
            type="button"
            variant={discount.type === "fixed" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            disabled={isRedeemingPoints}
            onClick={() => handleChangeType("fixed")}
          >
            ₫
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DiscountSection;
