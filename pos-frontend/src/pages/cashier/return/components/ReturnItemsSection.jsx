import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Minus, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSelector, useDispatch } from "react-redux";
import {
  createRefund,
  getRefundsByBranch,
} from "../../../../Redux Toolkit/features/refund/refundThunks";
import { getOrdersByBranch } from "../../../../Redux Toolkit/features/order/orderThunks";
import { getInventoryByBranch } from "../../../../Redux Toolkit/features/inventory/inventoryThunks";

const returnReasons = [
  "Damaged product",
  "Wrong product",
  "Customer changed mind",
  "Product quality issue",
  "Pricing error",
  "Other",
];

const ReturnItemsSection = ({
  selectedOrder,
  setShowReceiptDialog,
  onRefundSuccess,
}) => {
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);
  const { refundsByBranch = [] } = useSelector((state) => state.refund);
  const dispatch = useDispatch();

  const [returnReason, setReturnReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const {
    alreadyRefunded,
    remainingRefundable,
    netOrderFactor,
    returnableItems,
  } = useMemo(() => {
    const orderItems = selectedOrder?.items || [];
    const orderTotal = Number(selectedOrder?.totalAmount || 0);
    const rawSubTotal = Number(selectedOrder?.subTotal || 0);
    const effectiveSubTotal = rawSubTotal > 0 ? rawSubTotal : orderTotal;
    const factor =
      effectiveSubTotal > 0 ? orderTotal / effectiveSubTotal : 1.0;

    const orderRefunds = (refundsByBranch || []).filter(
      (r) => r?.orderId === selectedOrder?.id,
    );
    let refundedSum = 0;
    const returnedByItem = new Map();
    const returnedByProduct = new Map();

    for (const r of orderRefunds) {
      refundedSum += Number(r?.amount || 0);
      for (const ri of r?.items || []) {
        const q = Number(ri?.quantity || 0);
        if (q <= 0) continue;
        if (ri.orderItemId != null) {
          returnedByItem.set(
            ri.orderItemId,
            (returnedByItem.get(ri.orderItemId) || 0) + q,
          );
        } else if (ri.productId != null) {
          returnedByProduct.set(
            ri.productId,
            (returnedByProduct.get(ri.productId) || 0) + q,
          );
        }
      }
    }

    const mappedItems = orderItems.map((oi) => {
      const orderedQty = Number(oi.quantity || 0);
      let prevReturned = Number(returnedByItem.get(oi.id) || 0);
      if (prevReturned === 0 && oi.product?.id != null) {
        const fb = returnedByProduct.get(oi.product.id) || 0;
        if (fb > 0) {
          prevReturned = Math.min(orderedQty, fb);
          returnedByProduct.set(oi.product.id, fb - prevReturned);
        }
      }
      const remainingQty = Math.max(0, orderedQty - prevReturned);
      const rawUnitPrice =
        oi.price != null && orderedQty > 0
          ? Number(oi.price) / orderedQty
          : Number(oi.product?.sellingPrice || 0);
      const netUnitPrice = rawUnitPrice * factor;

      return {
        orderItemId: oi.id,
        productId: oi.product?.id || null,
        productName: oi.product?.name || "Deleted Product",
        orderedQty,
        prevReturned,
        remainingQty,
        netUnitPrice,
      };
    });

    return {
      alreadyRefunded: refundedSum,
      remainingRefundable: Math.max(0, orderTotal - refundedSum),
      netOrderFactor: factor,
      returnableItems: mappedItems,
    };
  }, [selectedOrder, refundsByBranch]);

  useEffect(() => {
    const initial = {};
    for (const item of returnableItems) {
      initial[item.orderItemId] = item.remainingQty;
    }
    setReturnQuantities(initial);
  }, [selectedOrder?.id, returnableItems]);

  const updateItemQuantity = (orderItemId, maxQty, nextQty) => {
    const clamped = Math.max(0, Math.min(maxQty, Number(nextQty || 0)));
    setReturnQuantities((prev) => ({
      ...prev,
      [orderItemId]: clamped,
    }));
  };

  const handleSelectAllRemaining = () => {
    const all = {};
    for (const item of returnableItems) {
      all[item.orderItemId] = item.remainingQty;
    }
    setReturnQuantities(all);
  };

  const handleClearSelection = () => {
    const cleared = {};
    for (const item of returnableItems) {
      cleared[item.orderItemId] = 0;
    }
    setReturnQuantities(cleared);
  };

  const {
    selectedItemsPayload,
    selectedReceiptItems,
    totalSelectedQty,
    returningAllRemaining,
    calculatedRefundAmount,
  } = useMemo(() => {
    const payload = [];
    const receiptItems = [];
    let selectedCount = 0;
    let allRemaining = true;
    let sumNetLines = 0;

    for (const item of returnableItems) {
      const qty = Math.max(
        0,
        Math.min(
          item.remainingQty,
          Number(returnQuantities[item.orderItemId] ?? 0),
        ),
      );
      if (qty < item.remainingQty) {
        allRemaining = false;
      }
      if (qty > 0) {
        selectedCount += qty;
        const lineAmount = Math.round(item.netUnitPrice * qty * 100) / 100;
        sumNetLines += lineAmount;
        payload.push({
          orderItemId: item.orderItemId,
          productId: item.productId,
          quantity: qty,
        });
        receiptItems.push({
          orderItemId: item.orderItemId,
          productId: item.productId,
          productName: item.productName,
          quantity: qty,
          unitPrice: Math.round(item.netUnitPrice * 100) / 100,
          refundAmount: lineAmount,
        });
      }
    }

    const finalAmount =
      selectedCount === 0
        ? 0
        : allRemaining
          ? remainingRefundable
          : Math.min(
              remainingRefundable,
              Math.round(sumNetLines * 100) / 100,
            );

    return {
      selectedItemsPayload: payload,
      selectedReceiptItems: receiptItems,
      totalSelectedQty: selectedCount,
      returningAllRemaining: allRemaining && selectedCount > 0,
      calculatedRefundAmount: finalAmount,
    };
  }, [returnableItems, returnQuantities, remainingRefundable]);

  const processRefund = async () => {
    if (totalSelectedQty <= 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least 1 item quantity to return.",
        variant: "destructive",
      });
      return;
    }

    const finalReason =
      returnReason === "Other" ? otherReason.trim() : returnReason;
    if (!finalReason) {
      toast({
        title: "Missing Return Reason",
        description:
          "Please select or specify a return reason before processing the refund.",
        variant: "destructive",
      });
      return;
    }

    const resolvedMethod = (
      refundMethod === "original"
        ? selectedOrder.paymentType || "CASH"
        : refundMethod
    ).toUpperCase();

    const refundDTO = {
      orderId: selectedOrder.id,
      branchId: branch?.id,
      cashierId: userProfile?.id,
      reason: finalReason,
      paymentType: resolvedMethod,
      amount: calculatedRefundAmount,
      items: selectedItemsPayload,
    };

    setSubmitting(true);
    try {
      const createdRefund = await dispatch(createRefund(refundDTO)).unwrap();
      if (branch?.id) {
        dispatch(getRefundsByBranch(branch.id));
        dispatch(getOrdersByBranch({ branchId: branch.id }));
        dispatch(getInventoryByBranch(branch.id));
      }
      const actualAmount = Number(
        createdRefund?.amount ?? calculatedRefundAmount ?? 0,
      );
      if (onRefundSuccess) {
        onRefundSuccess({
          id: createdRefund?.id,
          reason: finalReason,
          refundMethod: resolvedMethod,
          amount: actualAmount,
          items:
            createdRefund?.items && createdRefund.items.length > 0
              ? createdRefund.items
              : selectedReceiptItems,
        });
      }
      setShowReceiptDialog(true);
      toast({
        title: returningAllRemaining
          ? "Full Refund Processed"
          : "Partial Refund Processed",
        description: `Refund of ₫${actualAmount.toLocaleString("vi-VN")} (${totalSelectedQty} item(s)) processed via ${resolvedMethod}. Inventory restored immediately.`,
      });
    } catch (error) {
      toast({
        title: "Refund Failed",
        description: error || "Failed to process refund. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-1/2 p-4 flex flex-col overflow-y-auto">
      <Card className="mt-2">
        <CardContent className="p-4 space-y-4">
          {/* Danh sách chọn sản phẩm & số lượng hoàn trả (Partial hoặc Full Refund) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">
                Items &amp; Quantities to Return
              </Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={handleSelectAllRemaining}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
              {returnableItems.map((item) => {
                const selectedQty = Number(
                  returnQuantities[item.orderItemId] ?? 0,
                );
                const isExhausted = item.remainingQty <= 0;

                return (
                  <div
                    key={item.orderItemId}
                    className={`p-2.5 flex items-center justify-between gap-3 text-sm ${
                      isExhausted ? "opacity-50 bg-muted/40" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {item.productName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ₫{Math.round(item.netUnitPrice).toLocaleString("vi-VN")}{" "}
                        / unit • Returnable: {item.remainingQty} /{" "}
                        {item.orderedQty}
                        {netOrderFactor !== 1 && " (net of tax/discount)"}
                      </div>
                    </div>

                    {isExhausted ? (
                      <Badge variant="secondary" className="text-xs">
                        Already Returned
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={selectedQty <= 0}
                          onClick={() =>
                            updateItemQuantity(
                              item.orderItemId,
                              item.remainingQty,
                              selectedQty - 1,
                            )
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center font-semibold">
                          {selectedQty}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={selectedQty >= item.remainingQty}
                          onClick={() =>
                            updateItemQuantity(
                              item.orderItemId,
                              item.remainingQty,
                              selectedQty + 1,
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="return-reason" className="mb-2 block">
              Return Reason
            </Label>
            <Select
              value={returnReason}
              onValueChange={(value) => setReturnReason(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {returnReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {returnReason === "Other" && (
            <div>
              <Label htmlFor="other-reason" className="mb-2 block">
                Specify Reason
              </Label>
              <Textarea
                id="other-reason"
                placeholder="Please specify the return reason"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="refund-method" className="mb-2 block">
              Refund Method
            </Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select refund method..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">
                  Original Payment Method ({selectedOrder.paymentType || "CASH"}
                  )
                </SelectItem>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="CARD">Card</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Refund Type:</span>
              <span>
                {totalSelectedQty === 0
                  ? "None selected"
                  : returningAllRemaining
                    ? alreadyRefunded > 0
                      ? "Final Remaining Refund"
                      : "Full Order Refund"
                    : `Partial Refund (${totalSelectedQty} item(s))`}
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total Refund Amount:</span>
              <span>
                ₫{Number(calculatedRefundAmount || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={processRefund}
            disabled={
              submitting || totalSelectedQty <= 0 || remainingRefundable <= 0
            }
          >
            {submitting
              ? "Processing Refund..."
              : `Process Refund (₫${Number(
                  calculatedRefundAmount || 0,
                ).toLocaleString("vi-VN")})`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnItemsSection;
