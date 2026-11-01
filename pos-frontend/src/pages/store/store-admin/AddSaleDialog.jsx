import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (open && store?.id) {
      const jwt = localStorage.getItem("jwt");
      dispatch(getAllBranchesByStore({ storeId: store.id, jwt }));
      dispatch(getProductsByStore(store.id));
    }
  }, [open, store, dispatch]);

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

    setLoading(true);
    try {
      const chosenProduct = products?.find(
        (p) => String(p.id) === String(selectedProduct),
      );
      const unitPrice = Number(
        chosenProduct?.sellingPrice ?? chosenProduct?.price ?? 0,
      );
      const qty = Number(quantity);
      const subTotal = unitPrice * qty;
      const taxAmount = Math.round(subTotal * 0.1);

      const orderData = {
        branchId: Number(selectedBranch),
        paymentType: paymentType,
        taxAmount: taxAmount,
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
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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
                  products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name} - đ{product.price || product.sellingPrice}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No products available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
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

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? "Adding..." : "Confirm Sale"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
