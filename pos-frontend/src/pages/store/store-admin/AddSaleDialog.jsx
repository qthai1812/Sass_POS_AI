import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

import { getAllBranchesByStore } from "../../../Redux Toolkit/features/branch/branchThunks";
import { getProductsByStore } from "../../../Redux Toolkit/features/product/productThunks";
import { getInventoryByBranch } from "../../../Redux Toolkit/features/inventory/inventoryThunks";
import { createOrder } from "../../../Redux Toolkit/features/order/orderThunks";

export default function AddSaleDialog({ onSaleAdded }) {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentType, setPaymentType] = useState("CASH");

  const { store } = useSelector((state) => state.store);
  const { branches } = useSelector((state) => state.branch);
  const { products } = useSelector((state) => state.product);
  const { inventories = [] } = useSelector((state) => state.inventory);

  const chosenProduct = products?.find((p) => String(p.id) === String(selectedProduct));
  const unitPrice = Number(chosenProduct?.sellingPrice ?? chosenProduct?.price ?? 0);
  const currentQty = Number(quantity || 0);
  const subTotal = unitPrice * currentQty;
  const configuredTaxRate = Number(store?.taxRate ?? 10);
  const estimatedTax = Math.round(subTotal * (configuredTaxRate / 100));
  const estimatedTotal = subTotal + estimatedTax;

  useEffect(() => {
    if (open && store?.id) {
      const jwt = localStorage.getItem("jwt");
      dispatch(getAllBranchesByStore({ storeId: store.id, jwt }));
      dispatch(getProductsByStore(store.id));
    }
  }, [open, store, dispatch]);

  useEffect(() => {
    if (selectedBranch) {
      dispatch(getInventoryByBranch(Number(selectedBranch)));
    }
  }, [dispatch, selectedBranch]);

  const branchStockMap = useMemo(() => {
    const map = {};
    (inventories || []).forEach((inv) => {
      const pid = Number(inv.productId ?? inv.product?.id);
      if (pid) {
        map[pid] = (map[pid] || 0) + Number(inv.quantity ?? 0);
      }
    });
    return map;
  }, [inventories]);

  const getAvailableStock = (productId) => {
    if (!productId) return 0;
    return branchStockMap[Number(productId)] ?? 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch || !selectedProduct || quantity < 1) {
      toast({
        title: "Error",
        description: "Please fill all fields correctly",
        variant: "destructive",
      });
      return;
    }

    const availableStock = getAvailableStock(selectedProduct);
    if (Number(quantity) > availableStock) {
      toast({
        title: "Không đủ tồn kho",
        description: `Sản phẩm này chỉ còn ${availableStock} sản phẩm tại chi nhánh đã chọn (yêu cầu: ${quantity}).`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const chosen = products?.find(
        (p) => String(p.id) === String(selectedProduct),
      );
      const price = Number(
        chosen?.sellingPrice ?? chosen?.price ?? 0,
      );
      const qty = Number(quantity);
      const sub = price * qty;
      const tax = estimatedTax;

      const orderData = {
        branchId: Number(selectedBranch),
        paymentType: paymentType,
        taxAmount: tax,
        subTotal: sub,
        totalAmount: sub + tax,
        items: [{ productId: Number(selectedProduct), quantity: qty }],
      };

      await dispatch(createOrder(orderData)).unwrap();
      toast({ title: "Success", description: "Sale added successfully!" });
      setOpen(false);
      setSelectedBranch("");
      setSelectedProduct("");
      setQuantity(1);
      if (onSaleAdded) onSaleAdded();
    } catch (error) {
      toast({
        title: "Error",
        description: error || "Failed to add sale",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const maxStock = getAvailableStock(selectedProduct);
  const isOverStock = Boolean(
    selectedBranch && selectedProduct && Number(quantity) > maxStock
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Manual Sale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Branch</label>
            <Select value={selectedBranch} onValueChange={(val) => {
              setSelectedBranch(val);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.length > 0 ? (
                  branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No branches available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Product</label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products?.length > 0 ? (
                  products.map((product) => {
                    const stock = getAvailableStock(product.id);
                    const isOutOfStock = Boolean(selectedBranch && stock <= 0);
                    return (
                      <SelectItem
                        key={product.id}
                        value={product.id.toString()}
                        disabled={isOutOfStock}
                      >
                        {product.name} — đ{Number(product.sellingPrice ?? product.price ?? 0).toLocaleString("vi-VN")}{" "}
                        {selectedBranch ? `(Tồn kho: ${stock})` : ""}
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="none" disabled>
                    No products available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              min="1"
              max={selectedBranch && selectedProduct ? Math.max(1, maxStock) : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={isOverStock ? "border-red-500 focus-visible:ring-red-500" : ""}
              required
            />
            {selectedBranch && selectedProduct && (
              <p
                className={`text-xs ${
                  isOverStock || maxStock === 0
                    ? "text-red-500 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {maxStock === 0
                  ? "Sản phẩm đã hết hàng tại chi nhánh này"
                  : isOverStock
                    ? `Vượt quá tồn kho chi nhánh (Tối đa: ${maxStock})`
                    : `Tồn khả dụng: ${maxStock}`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Type</label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">CASH</SelectItem>
                <SelectItem value="CARD">CARD</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {chosenProduct && currentQty > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1 border">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính ({currentQty} SP):</span>
                <span>đ{subTotal.toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Thuế VAT ({configuredTaxRate}%):</span>
                <span>đ{estimatedTax.toLocaleString("vi-VN")}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground pt-1 border-t">
                <span>Tổng cộng dự kiến:</span>
                <span className="text-emerald-600">đ{estimatedTotal.toLocaleString("vi-VN")}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={loading || isOverStock || (Boolean(selectedBranch && selectedProduct && maxStock === 0))}
          >
            {loading ? "Adding..." : "Confirm Sale"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
