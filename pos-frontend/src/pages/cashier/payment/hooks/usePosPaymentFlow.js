import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/components/ui/use-toast";
import api from "@/utils/api";
import {
  mergeGatewaySession,
  resolveActiveQrImageUrl,
} from "@/utils/paymentGatewayUtils";
import { useMomoWebhookPolling } from "@/hooks/useMomoWebhookPolling";
import { useGatewayPaymentControls } from "@/hooks/useGatewayPaymentControls";
import {
  selectCartItems,
  selectCouponCode,
  selectDiscountAmount,
  selectNote,
  selectPaymentMethod,
  selectSelectedCustomer,
  selectSubtotal,
  selectTax,
  selectTaxRate,
  selectTotal,
  setCurrentOrder,
  setPaymentMethod,
  resetOrder,
} from "../../../../Redux Toolkit/features/cart/cartSlice";
import {
  createOrder,
  updateOrderStatus,
} from "../../../../Redux Toolkit/features/order/orderThunks";
import { getInventoryByBranch } from "../../../../Redux Toolkit/features/inventory/inventoryThunks";
import {
  startShift,
  getCurrentShiftProgress,
} from "../../../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import {
  EMPTY_PAYMENT_INFO,
  buildOrderPayload,
  buildPaymentNote,
  computeCashPaymentMetrics,
  computeLoyaltySummary,
  filterEnabledPaymentMethods,
  resolveMerchantPaymentInfo,
} from "../paymentDialogUtils";

export function usePosPaymentFlow({
  showPaymentDialog,
  setShowPaymentDialog,
  setShowReceiptDialog,
}) {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const cart = useSelector(selectCartItems);
  const subTotal = useSelector(selectSubtotal);
  const taxAmount = useSelector(selectTax);
  const taxRate = useSelector(selectTaxRate);
  const discountAmount = useSelector(selectDiscountAmount);
  const total = useSelector(selectTotal);
  const paymentMethod = useSelector(selectPaymentMethod);
  const selectedCustomer = useSelector(selectSelectedCustomer);
  const note = useSelector(selectNote);
  const couponCode = useSelector(selectCouponCode);

  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);
  const { currentShift } = useSelector((state) => state.shiftReport);

  const [processing, setProcessing] = useState(false);
  const [startingShift, setStartingShift] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [pendingOrder, setPendingOrder] = useState(null);

  const pendingOrderRef = useRef(null);
  const creatingPendingOrderRef = useRef(false);
  const orderCompletedRef = useRef(false);

  const gw = useGatewayPaymentControls();
  const {
    gatewaySession,
    setGatewaySession,
    setCreatingSession,
    qrMode,
    cardNumber,
    resetCardFields,
    resetGatewayDisplay,
    fillSampleCard,
    triggerMomoWebhook,
    authorizeCardWithGateway,
  } = gw;

  const paymentInfo = store?.paymentInfo || EMPTY_PAYMENT_INFO;
  const enabledMethods = useMemo(
    () => filterEnabledPaymentMethods(paymentInfo),
    [paymentInfo],
  );
  const rawSelected = (paymentMethod || enabledMethods[0]?.id || "CASH").toUpperCase();
  const isSelectedEnabled = enabledMethods.some((m) => m.id === rawSelected);
  const normalizedSelected = isSelectedEnabled
    ? rawSelected
    : enabledMethods[0]?.id || "CASH";

  useEffect(() => {
    if (showPaymentDialog && !isSelectedEnabled && enabledMethods[0]?.id) {
      dispatch(setPaymentMethod(enabledMethods[0].id));
    }
  }, [showPaymentDialog, isSelectedEnabled, enabledMethods, dispatch]);
  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id;
  const needsShift = userProfile?.role === "ROLE_CASHIER" && !currentShift;

  const loyaltySummary = useMemo(
    () =>
      computeLoyaltySummary({ selectedCustomer, couponCode, subTotal, total }),
    [selectedCustomer, couponCode, subTotal, total],
  );

  const cashMetrics = useMemo(
    () =>
      computeCashPaymentMetrics({
        normalizedMethod: normalizedSelected,
        cashReceived,
        total,
      }),
    [normalizedSelected, cashReceived, total],
  );

  const merchantInfo = useMemo(
    () => resolveMerchantPaymentInfo({ paymentInfo, store }),
    [paymentInfo, store],
  );

  const finalizeOrderCreation = useCallback(
    async (thirdPartyInfo = null) => {
      if (orderCompletedRef.current || !cart || cart.length === 0) return;

      if (!resolvedBranchId) {
        toast({
          title: "Thiếu thông tin chi nhánh",
          description: "Không xác định được chi nhánh hiện tại để tạo đơn hàng.",
          variant: "destructive",
        });
        return;
      }

      if (needsShift) {
        toast({
          title: "Chưa mở ca làm việc",
          description:
            "Vui lòng bấm 'Mở ca ngay' phía trên trước khi hoàn tất thanh toán.",
          variant: "destructive",
        });
        return;
      }

      if (cashMetrics.isInsufficientCash) {
        toast({
          title: "Số tiền khách đưa chưa đủ",
          description: `Số tiền mặt khách đưa (₫${Number(cashReceived || 0).toLocaleString("vi-VN")}) thấp hơn tổng tiền đơn hàng (₫${Number(total || 0).toLocaleString("vi-VN")}).`,
          variant: "destructive",
        });
        return;
      }

      orderCompletedRef.current = true;
      setProcessing(true);
      try {
        const paymentNote = buildPaymentNote({
          baseNote: note,
          normalizedMethod: normalizedSelected,
          thirdPartyInfo,
          cardNumber,
          momoPhone: merchantInfo.momoPhone,
          gatewaySessionReferenceCode: gatewaySession?.referenceCode,
        });

        const sessionToUse =
          thirdPartyInfo?.sessionId || gatewaySession?.sessionId || null;
        const activePendingId =
          pendingOrderRef.current?.id || thirdPartyInfo?.orderId || null;

        let createdOrder;
        if (activePendingId) {
          createdOrder = await dispatch(
            updateOrderStatus({
              id: activePendingId,
              status: "COMPLETED",
              paymentType: normalizedSelected,
              paymentSessionId:
                normalizedSelected === "CASH" ? null : sessionToUse,
            }),
          ).unwrap();
        } else {
          const orderData = buildOrderPayload({
            subTotal,
            taxAmount,
            discountAmount,
            couponCode,
            total,
            branchId: resolvedBranchId,
            cashierId: userProfile?.id,
            selectedCustomer,
            cart,
            paymentType: normalizedSelected,
            paymentSessionId: sessionToUse,
            note: paymentNote,
          });
          createdOrder = await dispatch(createOrder(orderData)).unwrap();
        }

        pendingOrderRef.current = null;
        setPendingOrder(null);
        dispatch(resetOrder());
        dispatch(setCurrentOrder(createdOrder));
        dispatch(getInventoryByBranch(resolvedBranchId));
        dispatch(getCurrentShiftProgress());

        setCashReceived("");
        resetCardFields();
        setGatewaySession(null);
        setShowPaymentDialog(false);
        setShowReceiptDialog(true);

        const newCustomerPts = createdOrder?.customer?.loyaltyPoints;
        toast({
          title:
            normalizedSelected === "CASH"
              ? "Thanh toán tiền mặt thành công!"
              : "Đã nhận thông báo thanh toán thành công từ bên thứ 3!",
          description:
            newCustomerPts !== undefined && newCustomerPts !== null
              ? `Đơn #${createdOrder.id} hoàn tất! Điểm tích lũy KH: ${newCustomerPts} điểm.`
              : `Đơn hàng #${createdOrder.id} đã tự động hoàn tất và xuất hóa đơn.`,
        });
      } catch (error) {
        orderCompletedRef.current = false;
        toast({
          title: "Không thể tạo đơn hàng",
          description:
            typeof error === "string"
              ? error
              : error?.message || "Failed to create order",
          variant: "destructive",
        });
      } finally {
        setProcessing(false);
      }
    },
    [
      cart,
      resolvedBranchId,
      needsShift,
      cashMetrics.isInsufficientCash,
      cashReceived,
      note,
      normalizedSelected,
      cardNumber,
      merchantInfo.momoPhone,
      gatewaySession,
      subTotal,
      taxAmount,
      discountAmount,
      couponCode,
      total,
      userProfile,
      selectedCustomer,
      dispatch,
      resetCardFields,
      setGatewaySession,
      setShowPaymentDialog,
      setShowReceiptDialog,
      toast,
    ],
  );

  // Đảm bảo có bản ghi Order trạng thái PENDING trong Database khi chờ thanh toán QR / Thẻ
  const ensurePendingOrderInDb = useCallback(
    async (methodType) => {
      if (pendingOrderRef.current?.id) {
        return pendingOrderRef.current;
      }
      if (
        creatingPendingOrderRef.current ||
        !resolvedBranchId ||
        needsShift ||
        !cart ||
        cart.length === 0
      ) {
        return null;
      }
      creatingPendingOrderRef.current = true;
      try {
        const orderPayload = buildOrderPayload({
          subTotal,
          taxAmount,
          discountAmount,
          couponCode,
          total,
          branchId: resolvedBranchId,
          cashierId: userProfile?.id,
          selectedCustomer,
          cart,
          paymentType: methodType,
          status: "PENDING",
          note,
        });
        const created = await dispatch(createOrder(orderPayload)).unwrap();
        pendingOrderRef.current = created;
        setPendingOrder(created);
        return created;
      } catch (err) {
        console.error("Could not create PENDING order:", err);
        return null;
      } finally {
        creatingPendingOrderRef.current = false;
      }
    },
    [
      resolvedBranchId,
      needsShift,
      cart,
      subTotal,
      taxAmount,
      discountAmount,
      couponCode,
      total,
      userProfile,
      selectedCustomer,
      note,
      dispatch,
    ],
  );

  const handleClosePaymentDialog = useCallback(
    async (nextOpen) => {
      if (nextOpen) {
        setShowPaymentDialog(true);
        return;
      }
      if (processing) return;
      const pendingToCancel = pendingOrderRef.current;
      if (pendingToCancel?.id && !orderCompletedRef.current) {
        pendingOrderRef.current = null;
        setPendingOrder(null);
        try {
          await dispatch(
            updateOrderStatus({ id: pendingToCancel.id, status: "CANCELLED" }),
          ).unwrap();
          if (resolvedBranchId) {
            dispatch(getInventoryByBranch(resolvedBranchId));
          }
        } catch (err) {
          console.warn("Could not cancel pending order on dialog close:", err);
        }
      }
      resetGatewayDisplay();
      setShowPaymentDialog(false);
    },
    [
      processing,
      dispatch,
      resolvedBranchId,
      resetGatewayDisplay,
      setShowPaymentDialog,
    ],
  );

  const initGatewaySession = useCallback(
    async (methodType) => {
      if (!showPaymentDialog || methodType === "CASH" || !total || total <= 0) {
        setGatewaySession(null);
        return;
      }
      setCreatingSession(true);
      orderCompletedRef.current = false;
      try {
        const ensuredOrder = await ensurePendingOrderInDb(methodType);
        const res = await api.post("/api/payment-gateway/sessions", {
          storeId: store?.id || null,
          storeName: store?.brand || "POS Pro Store",
          orderId: ensuredOrder?.id || null,
          amount: Math.round(total || 0),
          method: methodType === "UPI" ? "MOMO" : "CARD",
          recipientPhone: merchantInfo.momoPhone,
          recipientName: merchantInfo.momoOwnerName,
          bankName: merchantInfo.storeCardBank,
          bankAccount: merchantInfo.gatewayBankAccount,
        });
        setGatewaySession((prev) => mergeGatewaySession(prev, res.data));
      } catch (err) {
        console.error("Failed to create payment gateway session:", err);
      } finally {
        setCreatingSession(false);
      }
    },
    [
      showPaymentDialog,
      total,
      ensurePendingOrderInDb,
      store,
      merchantInfo,
      setCreatingSession,
      setGatewaySession,
    ],
  );

  useEffect(() => {
    if (showPaymentDialog) {
      orderCompletedRef.current = false;
      if (normalizedSelected === "UPI" || normalizedSelected === "CARD") {
        initGatewaySession(normalizedSelected);
      } else {
        setGatewaySession(null);
      }
    } else {
      resetGatewayDisplay();
    }
  }, [
    showPaymentDialog,
    normalizedSelected,
    initGatewaySession,
    setGatewaySession,
    resetGatewayDisplay,
  ]);

  const handleMomoPollSuccess = useCallback(
    (updated) => {
      if (!orderCompletedRef.current) {
        finalizeOrderCreation(updated);
      }
    },
    [finalizeOrderCreation],
  );

  useMomoWebhookPolling({
    enabled: showPaymentDialog && normalizedSelected === "UPI",
    gatewaySession,
    onSessionChange: setGatewaySession,
    onSuccess: handleMomoPollSuccess,
  });

  const handleTriggerMomoWebhook = (status = "SUCCESS") =>
    triggerMomoWebhook({
      providerName: "MoMo / Napas247 IPN Webhook",
      status,
      onSuccess: async (data) => {
        if (!orderCompletedRef.current) {
          await finalizeOrderCreation(data);
        }
      },
      onError: (err) => {
        toast({
          title: "Lỗi kết nối Webhook",
          description:
            err?.response?.data?.message || "Không thể gửi tín hiệu Webhook.",
          variant: "destructive",
        });
      },
    });

  const handleAuthorizeCardGateway = () => {
    if (needsShift) {
      toast({
        title: "Chưa mở ca làm việc",
        description:
          "Vui lòng bấm 'Mở ca ngay' trước khi thực hiện giao dịch.",
        variant: "destructive",
      });
      return;
    }

    return authorizeCardWithGateway({
      ensureSessionId: async () => {
        if (gatewaySession?.method === "CARD" && gatewaySession?.sessionId) {
          return gatewaySession.sessionId;
        }
        try {
          const ensuredOrder = await ensurePendingOrderInDb("CARD");
          const res = await api.post("/api/payment-gateway/sessions", {
            storeId: store?.id || null,
            storeName: store?.brand || "POS Pro Store",
            orderId: ensuredOrder?.id || null,
            amount: Math.round(total || 0),
            method: "CARD",
          });
          setGatewaySession((prev) => mergeGatewaySession(prev, res.data));
          return res.data.sessionId;
        } catch (err) {
          toast({
            title: "Không thể khởi tạo phiên thanh toán Thẻ",
            description: err?.response?.data?.message || "Vui lòng thử lại.",
            variant: "destructive",
          });
          return null;
        }
      },
      verifyingStepText:
        "Đang xác thực bảo mật 3D-Secure & kiểm tra hạn mức thẻ với ngân hàng phát hành...",
      formatSuccessStepText: (s) =>
        `Ngân hàng xác nhận thành công (Mã chuẩn chi: ${s.transactionId}). Đang hoàn tất đơn hàng...`,
      onBusyChange: setProcessing,
      onSuccess: (updatedSession) => finalizeOrderCreation(updatedSession),
      onDeclined: (providerMessage) => {
        toast({
          title: "Cổng thanh toán Thẻ từ chối giao dịch",
          description:
            providerMessage ||
            "Thông tin thẻ không hợp lệ hoặc ngân hàng phát hành từ chối.",
          variant: "destructive",
        });
      },
    });
  };

  const handleSelectPaymentMethod = (methodId) => {
    dispatch(setPaymentMethod(methodId));
    if (pendingOrderRef.current?.id) {
      dispatch(
        updateOrderStatus({
          id: pendingOrderRef.current.id,
          status: "PENDING",
          paymentType: methodId,
        }),
      );
    }
  };

  const handleQuickStartShift = async () => {
    setStartingShift(true);
    try {
      await dispatch(startShift(resolvedBranchId)).unwrap();
      await dispatch(getCurrentShiftProgress());
      toast({
        title: "Đã mở ca làm việc",
        description: "Bây giờ bạn có thể thực hiện thanh toán đơn hàng.",
      });
    } catch (err) {
      toast({
        title: "Không thể mở ca",
        description: typeof err === "string" ? err : "Vui lòng thử lại",
        variant: "destructive",
      });
    } finally {
      setStartingShift(false);
    }
  };

  const handleFillSampleCard = () =>
    fillSampleCard(
      (selectedCustomer?.fullName || "NGUYEN VAN KHACH").toUpperCase(),
    );

  const activeQrImageUrl = resolveActiveQrImageUrl({
    customQrImage: paymentInfo.momoQrImage,
    qrMode,
    gatewaySession,
    phone: merchantInfo.momoPhone,
    amount: total,
    defaultAddInfo: "POS THANH TOAN",
    accountName: merchantInfo.momoOwnerName,
  });

  return {
    cart,
    subTotal,
    taxAmount,
    taxRate,
    discountAmount,
    total,
    couponCode,
    selectedCustomer,
    normalizedSelected,
    enabledMethods,
    needsShift,
    processing,
    startingShift,
    pendingOrder,
    loyaltySummary,
    cashReceived,
    setCashReceived,
    cashMetrics,
    merchantInfo,
    activeQrImageUrl,
    ...gw,
    initGatewaySession,
    finalizeOrderCreation,
    handleClosePaymentDialog,
    handleSelectPaymentMethod,
    handleQuickStartShift,
    handleFillSampleCard,
    handleAuthorizeCardGateway,
    handleTriggerMomoWebhook,
  };
}
