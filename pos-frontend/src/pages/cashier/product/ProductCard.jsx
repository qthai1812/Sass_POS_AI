import React from "react";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "../../../components/ui/use-toast";
import {
  addToCart,
  selectCartItems,
} from "../../../Redux Toolkit/features/cart/cartSlice";

const ProductCard = ({ product, stockQuantity = 0, trackStock = true }) => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const cartItems = useSelector(selectCartItems);

  const cartItem = cartItems.find((item) => item.id === product.id);
  const inCartQty = cartItem?.quantity || 0;
  const totalStock = trackStock ? Number(stockQuantity ?? 0) : Infinity;
  const remainingStock = Math.max(0, totalStock - inCartQty);

  const isOutOfStock = trackStock && totalStock <= 0;
  const isMaxReached = trackStock && totalStock > 0 && remainingStock <= 0;
  const isDisabled = isOutOfStock || isMaxReached;

  const handleAddToCart = () => {
    if (isDisabled) return;

    dispatch(
      addToCart({
        ...product,
        maxStock: trackStock ? totalStock : undefined,
      }),
    );
    toast({
      title: "Added to cart",
      description: trackStock
        ? `${product.name} added to cart (Còn lại: ${remainingStock - 1})`
        : `${product.name} added to cart`,
      duration: 1500,
    });
  };

  return (
    <Card
      key={product.id}
      aria-disabled={isDisabled}
      className={`relative transition-all duration-200 border flex flex-col justify-between select-none ${
        isDisabled
          ? "opacity-55 grayscale cursor-not-allowed bg-muted/40 border-dashed"
          : "cursor-pointer hover:shadow-md hover:border-primary"
      }`}
      onClick={handleAddToCart}
    >
      <CardContent className="p-2.5 sm:p-3 flex flex-col h-full">
        <div className="relative aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
          {product.image ? (
            <img
              className="h-full w-full object-cover"
              src={product.image}
              alt={product.name}
            />
          ) : (
            <span className="text-xs text-muted-foreground">No Image</span>
          )}

          {isOutOfStock ? (
            <div className="absolute inset-0 bg-black/65 p-1.5 flex items-center justify-center text-center">
              <span className="bg-red-600/95 text-white text-[11px] leading-tight font-semibold px-2 py-1 rounded-md shadow">
                Hết hàng / Chưa nhập kho
              </span>
            </div>
          ) : isMaxReached ? (
            <div className="absolute inset-0 bg-black/60 p-1.5 flex items-center justify-center text-center">
              <span className="bg-amber-600 text-white text-[11px] leading-tight font-semibold px-2 py-1 rounded-md shadow">
                Đã chọn tối đa ({totalStock})
              </span>
            </div>
          ) : !trackStock ? null : (
            <span
              className={`absolute top-1.5 right-1.5 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-xs ${
                remainingStock <= 10
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}
            >
              Tồn: {remainingStock}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h3
              className="font-medium text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.25rem]"
              title={product.name}
            >
              {product.name}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {product.sku}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between mt-2 pt-1.5 border-t border-border/50 gap-1">
            <span className="font-bold text-emerald-500 text-xs sm:text-sm whitespace-nowrap">
              đ
              {Number(
                product.sellingPrice ?? product.price ?? 0,
              ).toLocaleString()}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 truncate max-w-[90px]"
            >
              {typeof product.category === "object"
                ? product.category?.name
                : product.category || "General"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
