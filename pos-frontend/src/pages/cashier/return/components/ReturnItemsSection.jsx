import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSelector, useDispatch } from "react-redux";
import {
  createRefund,
  getRefundsByBranch,
  getRefundsByOrder,
} from "../../../../Redux Toolkit/features/refund/refundThunks";
import {
  getOrderById,
  getOrdersByBranch,
} from "../../../../Redux Toolkit/features/order/orderThunks";
import { getInventoryByBranch } from "../../../../Redux Toolkit/features/inventory/inventoryThunks";
import { getCurrentShiftProgress } from "../../../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import {
  buildReturnableItems,
  calculateItemizedRefundSummary,
  clampReturnQuantities,
  mergeOrderRefunds,
  normalizeRefundError,
  validateRefundSubmission,
} from "../returnUtils";

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
  resolvedBranchId,
  setShowReceiptDialog,
  onRefundSuccess,
  isCashier = false,
  hasActiveShift = true,
}) => {
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);
  const { refundsByBranch = [], refundsByOrder = [] } = useSelector(
    (state) => state.refund,
  );
  const dispatch = useDispatch();

  const [refundMode, setRefundMode] = useState("ITEMS");
  const [returnReason, setReturnReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [adjustItemizedAmount, setAdjustItemizedAmount] = useState(false);
  const [manualItemizedAmount, setManualItemizedAmount] = useState("");
  const [amountOnlyInput, setAmountOnlyInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const returnReasonTriggerRef = useRef(null);
  const otherReasonRef = useRef(null);

  const effectiveBranchId =
    resolvedBranchId ||
    branch?.id ||
    userProfile?.branchId ||
    userProfile?.branch?.id ||
    selectedOrder?.branchId;

  const {
    alreadyRefunded,
    remainingRefundable,
    netOrderFactor,
    returnableItems,
  } = useMemo(() => {
    const orderRefunds = mergeOrderRefunds(
      selectedOrder?.id,
      refundsByOrder,
      refundsByBranch,
    );
    return buildReturnableItems(selectedOrder, orderRefunds);
  }, [selectedOrder, refundsByOrder, refundsByBranch]);

  const hasAnyReturnableQty = useMemo(
    () => returnableItems.some((item) => item.remainingQty > 0),
    [returnableItems],
  );

  // Initialize quantities to 0 for newly opened orders; clamp safely when order refunds arrive asynchronously.
  const prevOrderIdRef = useRef(selectedOrder?.id);
  useEffect(() => {
    const orderChanged = prevOrderIdRef.current !== selectedOrder?.id;
    prevOrderIdRef.current = selectedOrder?.id;

    setReturnQuantities((prev) =>
      clampReturnQuantities(orderChanged ? {} : prev, returnableItems, true),
    );

    if (orderChanged) {
      setAdjustItemizedAmount(false);
      setManualItemizedAmount("");
      setAmountOnlyInput("");
      setReturnReason("");
      setOtherReason("");
      setRefundMethod("original");
      setValidationError(null);
      setRefundMode(
        returnableItems.some((i) => i.remainingQty > 0) ? "ITEMS" : "AMOUNT",
      );
    }
  }, [selectedOrder?.id, returnableItems]);

  // If all physical items have already been returned while some balance remains (e.g. prior restocking fee),
  // default to Partial Amount Only tab.
  useEffect(() => {
    if (!hasAnyReturnableQty && remainingRefundable > 0 && refundMode === "ITEMS") {
      setRefundMode("AMOUNT");
    }
  }, [hasAnyReturnableQty, remainingRefundable, refundMode]);

  const updateItemQuantity = (orderItemId, maxQty, nextQty) => {
    const parsed = Number(nextQty);
    const clamped = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maxQty, Math.floor(parsed)))
      : 0;
    setValidationError(null);
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
    setValidationError(null);
    setReturnQuantities(all);
  };

  const handleClearSelection = () => {
    const cleared = {};
    for (const item of returnableItems) {
      cleared[item.orderItemId] = 0;
    }
    setValidationError(null);
    setReturnQuantities(cleared);
    setAdjustItemizedAmount(false);
    setManualItemizedAmount("");
  };

  const {
    selectedItemsPayload,
    selectedReceiptItems,
    totalSelectedQty,
    returningAllRemaining,
    itemsRefundValue,
    calculatedRefundAmount,
    maxAllowedForItemized,
  } = useMemo(
    () =>
      calculateItemizedRefundSummary(
        returnableItems,
        returnQuantities,
        remainingRefundable,
      ),
    [returnableItems, returnQuantities, remainingRefundable],
  );

  // Keep manual itemized input synced to calculated amount unless cashier actively edited it
  useEffect(() => {
    if (!adjustItemizedAmount) {
      setManualItemizedAmount(
        calculatedRefundAmount > 0 ? String(calculatedRefundAmount) : "",
      );
    }
  }, [adjustItemizedAmount, calculatedRefundAmount]);

  const effectiveRefundAmount =
    refundMode === "AMOUNT"
      ? Number(amountOnlyInput || 0)
      : adjustItemizedAmount
        ? Number(manualItemizedAmount || 0)
        : calculatedRefundAmount;

  const maxAllowedForCurrentMode =
    refundMode === "AMOUNT" ? remainingRefundable : maxAllowedForItemized;

  const itemizedFeeRetained =
    refundMode === "ITEMS" &&
    adjustItemizedAmount &&
    calculatedRefundAmount > 0 &&
    effectiveRefundAmount >= 0 &&
    effectiveRefundAmount < calculatedRefundAmount
      ? Math.round((calculatedRefundAmount - effectiveRefundAmount) * 100) / 100
      : 0;

  const processRefund = async () => {
    const finalReason =
      returnReason === "Other" ? otherReason.trim() : returnReason;

    const validation = validateRefundSubmission({
      refundMode,
      remainingRefundable,
      totalSelectedQty,
      refundAmount: effectiveRefundAmount,
      maxAllowedAmount: maxAllowedForCurrentMode,
      finalReason,
      isCashier,
      hasActiveShift,
    });

    if (!validation.valid) {
      const resolvedField =
        validation.field === "reason"
          ? returnReason === "Other"
            ? "otherReason"
            : "returnReason"
          : validation.field;

      setValidationError({
        ...validation,
        field: resolvedField,
      });

      toast({
        id: "refund-validation-error",
        title: validation.title,
        description: validation.description,
        variant: "destructive",
        duration: 3000,
      });

      if (resolvedField === "otherReason") {
        otherReasonRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        otherReasonRef.current?.focus();
      } else if (resolvedField === "returnReason") {
        returnReasonTriggerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        returnReasonTriggerRef.current?.focus();
      }
      return;
    }

    setValidationError(null);

    const resolvedMethod = (
      refundMethod === "original"
        ? selectedOrder.paymentType || "CASH"
        : refundMethod
    ).toUpperCase();

    const roundedAmount = Math.round(effectiveRefundAmount * 100) / 100;
    const refundDTO = {
      orderId: selectedOrder.id,
      branchId: effectiveBranchId,
      cashierId: userProfile?.id,
      reason: finalReason,
      paymentType: resolvedMethod,
      amount: roundedAmount,
      items: refundMode === "ITEMS" ? selectedItemsPayload : [],
    };

    setSubmitting(true);
    try {
      const createdRefund = await dispatch(createRefund(refundDTO)).unwrap();

      if (effectiveBranchId) {
        dispatch(getRefundsByBranch(effectiveBranchId));
        dispatch(getOrdersByBranch({ branchId: effectiveBranchId }));
        dispatch(getInventoryByBranch(effectiveBranchId));
      }
      dispatch(getRefundsByOrder(selectedOrder.id));
      dispatch(getOrderById(selectedOrder.id));
      if (isCashier) {
        dispatch(getCurrentShiftProgress());
      }

      const actualAmount = Number(createdRefund?.amount ?? roundedAmount ?? 0);
      const isOrderFullyRefunded =
        remainingRefundable - actualAmount <= 0.01;

      handleClearSelection();
      setAmountOnlyInput("");

      if (onRefundSuccess) {
        onRefundSuccess({
          id: createdRefund?.id,
          reason: finalReason,
          refundMethod: resolvedMethod,
          amount: actualAmount,
          refundMode,
          isOrderFullyRefunded,
          items:
            createdRefund?.items && createdRefund.items.length > 0
              ? createdRefund.items
              : refundMode === "ITEMS"
                ? selectedReceiptItems
                : [],
        });
      }
      setShowReceiptDialog(true);
      toast({
        title: isOrderFullyRefunded
          ? "Full Refund Processed"
          : "Partial Refund Processed",
        description:
          refundMode === "ITEMS"
            ? `Refund of ₫${actualAmount.toLocaleString("vi-VN")} (${totalSelectedQty} item(s)) processed via ${resolvedMethod}. Inventory restored immediately.`
            : `Amount refund of ₫${actualAmount.toLocaleString("vi-VN")} processed via ${resolvedMethod}.`,
      });
    } catch (error) {
      toast({
        title: "Refund Failed",
        description: normalizeRefundError(error),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full lg:w-1/2 p-4 flex flex-col min-h-0 overflow-y-auto">
      <Card className="mt-1">
        <CardContent className="p-4 space-y-4">
          <Tabs
            value={refundMode}
            onValueChange={(val) => {
              setRefundMode(val);
              setValidationError(null);
            }}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2 h-10">
              <TabsTrigger
                value="ITEMS"
                disabled={!hasAnyReturnableQty}
                className="text-xs sm:text-sm"
              >
                Return Items ({returnableItems.reduce((s, i) => s + i.remainingQty, 0)} left)
              </TabsTrigger>
              <TabsTrigger
                value="AMOUNT"
                disabled={remainingRefundable <= 0}
                className="text-xs sm:text-sm"
              >
                Partial Amount Only
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ITEMS" className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label className="font-semibold">
                    Items &amp; Quantities to Return
                  </Label>
                  {totalSelectedQty > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalSelectedQty} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={!hasAnyReturnableQty}
                    onClick={handleSelectAllRemaining}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    disabled={totalSelectedQty <= 0 && !adjustItemizedAmount}
                    onClick={handleClearSelection}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {returnableItems.map((item) => {
                  const selectedQty = Number(
                    returnQuantities[item.orderItemId] ?? 0,
                  );
                  const isExhausted = item.remainingQty <= 0;
                  const isChecked = selectedQty > 0;
                  const rowRefundPreview = Math.round(
                    item.netUnitPrice * selectedQty,
                  );

                  return (
                    <div
                      key={item.orderItemId}
                      className={`p-2.5 flex items-center justify-between gap-3 text-sm ${
                        isExhausted
                          ? "opacity-50 bg-muted/40"
                          : isChecked
                            ? "bg-primary/5"
                            : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Checkbox
                          checked={isChecked}
                          disabled={isExhausted}
                          aria-label={`Select ${item.productName}`}
                          className="mt-1 shrink-0"
                          onCheckedChange={(checked) =>
                            updateItemQuantity(
                              item.orderItemId,
                              item.remainingQty,
                              checked ? item.remainingQty : 0,
                            )
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {item.productName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ₫
                            {Math.round(item.netUnitPrice).toLocaleString(
                              "vi-VN",
                            )}{" "}
                            / unit • Returnable: {item.remainingQty} /{" "}
                            {item.orderedQty}
                            {item.prevReturned > 0 &&
                              ` • Returned: ${item.prevReturned}`}
                            {netOrderFactor !== 1 && " (net of tax/discount)"}
                          </div>
                          {selectedQty > 0 && (
                            <div className="text-xs font-medium text-emerald-600 mt-0.5">
                              Refund line: ₫
                              {rowRefundPreview.toLocaleString("vi-VN")}
                            </div>
                          )}
                        </div>
                      </div>

                      {isExhausted ? (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Already Returned
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={selectedQty <= 0}
                            aria-label={`Decrease ${item.productName}`}
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
                          <Input
                            type="number"
                            min={0}
                            max={item.remainingQty}
                            value={selectedQty}
                            aria-label={`Quantity to return for ${item.productName}`}
                            onChange={(e) =>
                              updateItemQuantity(
                                item.orderItemId,
                                item.remainingQty,
                                e.target.value,
                              )
                            }
                            className="h-8 w-14 text-center px-1 font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={selectedQty >= item.remainingQty}
                            aria-label={`Increase ${item.productName}`}
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

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={adjustItemizedAmount}
                    disabled={totalSelectedQty <= 0}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setAdjustItemizedAmount(next);
                      if (next) {
                        setManualItemizedAmount(
                          calculatedRefundAmount > 0
                            ? String(calculatedRefundAmount)
                            : "",
                        );
                      }
                    }}
                  />
                  <span>
                    Adjust refund amount (e.g. deduct restocking / damage fee)
                  </span>
                </label>

                {adjustItemizedAmount && totalSelectedQty > 0 && (
                  <div className="p-3 rounded-md border bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Default item value:</span>
                      <span>
                        ₫{Math.round(itemsRefundValue).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div>
                      <Label
                        htmlFor="manual-itemized-amount"
                        className="text-xs mb-1 block"
                      >
                        Custom Refund Amount (max ₫
                        {Math.round(maxAllowedForItemized).toLocaleString(
                          "vi-VN",
                        )}
                        )
                      </Label>
                      <Input
                        id="manual-itemized-amount"
                        type="number"
                        min={1}
                        max={maxAllowedForItemized}
                        step="100"
                        value={manualItemizedAmount}
                        aria-invalid={
                          validationError?.field === "amount" &&
                          refundMode === "ITEMS"
                        }
                        onChange={(e) => {
                          setManualItemizedAmount(e.target.value);
                          setValidationError(null);
                        }}
                        className={`h-9 ${
                          validationError?.field === "amount" &&
                          refundMode === "ITEMS"
                            ? "border-destructive ring-1 ring-destructive"
                            : ""
                        }`}
                      />
                    </div>
                    {itemizedFeeRetained > 0 && (
                      <div className="text-xs text-amber-600">
                        Fee retained: ₫
                        {Math.round(itemizedFeeRetained).toLocaleString("vi-VN")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="AMOUNT" className="space-y-3 pt-2">
              <div className="p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                Hoàn một phần tiền trực tiếp (bù trừ lỗi sản phẩm, hoàn nốt số
                tiền còn lại...). Chỉ hoàn trả số dư và{" "}
                <strong>không thay đổi tồn kho</strong> (trừ khi đạt 100% giá
                trị đơn hàng).
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="amount-only-input" className="font-semibold">
                    Partial Refund Amount (VND)
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Max: ₫
                    {Math.round(remainingRefundable).toLocaleString("vi-VN")}
                  </span>
                </div>
                <Input
                  id="amount-only-input"
                  type="number"
                  min={1}
                  max={remainingRefundable}
                  step="1000"
                  placeholder="Enter amount to refund..."
                  value={amountOnlyInput}
                  aria-invalid={
                    validationError?.field === "amount" &&
                    refundMode === "AMOUNT"
                  }
                  onChange={(e) => {
                    setAmountOnlyInput(e.target.value);
                    setValidationError(null);
                  }}
                  className={`h-10 ${
                    validationError?.field === "amount" &&
                    refundMode === "AMOUNT"
                      ? "border-destructive ring-1 ring-destructive"
                      : ""
                  }`}
                />
                <div className="flex flex-wrap gap-2">
                  {[0.25, 0.5, 1].map((ratio) => {
                    const preset =
                      ratio === 1
                        ? Math.round(remainingRefundable * 100) / 100
                        : Math.round(remainingRefundable * ratio);
                    return (
                      <Button
                        key={ratio}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={preset <= 0}
                        onClick={() => {
                          setAmountOnlyInput(String(preset));
                          setValidationError(null);
                        }}
                      >
                        {ratio === 1
                          ? "Remaining (100%)"
                          : `${Math.round(ratio * 100)}% (₫${preset.toLocaleString("vi-VN")})`}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div>
            <Label htmlFor="return-reason" className="mb-2 block">
              Return Reason <span className="text-destructive">*</span>
            </Label>
            <Select
              value={returnReason}
              onValueChange={(value) => {
                setReturnReason(value);
                setValidationError(null);
              }}
            >
              <SelectTrigger
                id="return-reason"
                ref={returnReasonTriggerRef}
                aria-invalid={validationError?.field === "returnReason"}
                className={`w-full ${
                  validationError?.field === "returnReason"
                    ? "border-destructive ring-1 ring-destructive focus:ring-destructive"
                    : ""
                }`}
              >
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
            {validationError?.field === "returnReason" && (
              <p className="text-xs font-medium text-destructive mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError.description}</span>
              </p>
            )}
          </div>

          {returnReason === "Other" && (
            <div>
              <Label htmlFor="other-reason" className="mb-2 block">
                Specify Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="other-reason"
                ref={otherReasonRef}
                placeholder="Please specify the return reason"
                value={otherReason}
                aria-invalid={validationError?.field === "otherReason"}
                onChange={(e) => {
                  setOtherReason(e.target.value);
                  setValidationError(null);
                }}
                className={
                  validationError?.field === "otherReason"
                    ? "border-destructive ring-1 ring-destructive"
                    : ""
                }
              />
              {validationError?.field === "otherReason" && (
                <p className="text-xs font-medium text-destructive mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError.description}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="refund-method" className="mb-2 block">
              Refund Method
            </Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger id="refund-method" className="w-full">
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
                {refundMode === "AMOUNT"
                  ? effectiveRefundAmount > 0 &&
                    remainingRefundable - effectiveRefundAmount <= 0.01
                    ? "Final Remaining Amount Refund"
                    : "Partial Amount Refund"
                  : totalSelectedQty === 0
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
                ₫
                {Math.max(0, Number(effectiveRefundAmount || 0)).toLocaleString(
                  "vi-VN",
                )}
              </span>
            </div>
          </div>

          {validationError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{validationError.title}</p>
                <p>{validationError.description}</p>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            onClick={processRefund}
            disabled={
              submitting ||
              remainingRefundable <= 0 ||
              (refundMode === "ITEMS"
                ? totalSelectedQty <= 0
                : !(Number(amountOnlyInput) > 0))
            }
          >
            {submitting
              ? "Processing Refund..."
              : `Process Refund (₫${Math.max(
                  0,
                  Number(effectiveRefundAmount || 0),
                ).toLocaleString("vi-VN")})`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnItemsSection;
