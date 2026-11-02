import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Star,
  Sparkles,
  Gift,
  Loader2,
  CheckCircle2,
  User,
  Lock,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  PlayCircle,
  AlertTriangle,
  Radio,
  ExternalLink,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import api from "@/utils/api";
import {
  selectCartItems,
  selectCouponCode,
  selectDiscountAmount,
  selectNote,
  selectPaymentMethod,
  selectSelectedCustomer,
  selectSubtotal,
  selectTax,
  selectTotal,
  setCurrentOrder,
  setPaymentMethod,
  resetOrder,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import { createOrder } from "../../../Redux Toolkit/features/order/orderThunks";
import { getInventoryByBranch } from "../../../Redux Toolkit/features/inventory/inventoryThunks";
import {
  startShift,
  getCurrentShiftProgress,
} from "../../../Redux Toolkit/features/shiftReport/shiftReportThunks";

const EMPTY_PAYMENT_INFO = {};
const VND_PER_POINT_EARNED = 10000; // 10.000₫ = +1 điểm
const VND_PER_POINT_REDEEMED = 1000; // 1 điểm = 1.000₫

const ALL_PAYMENT_METHODS = [
  {
    id: "CASH",
    configKey: "acceptCash",
    label: "Tiền mặt (Cash)",
    subLabel: "Thu tiền mặt tại quầy",
    icon: Banknote,
    activeClass:
      "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  {
    id: "UPI",
    configKey: "acceptMomo",
    label: "Chuyển khoản / QR MoMo",
    subLabel: "Tự động nhận thông báo QR",
    icon: Smartphone,
    activeClass:
      "border-[#A50064] bg-pink-50 text-[#A50064] dark:bg-pink-950/50 dark:text-pink-200",
  },
  {
    id: "CARD",
    configKey: "acceptCard",
    label: "Thẻ Visa / Thẻ ghi nợ",
    subLabel: "Cổng 3D-Secure tự động",
    icon: CreditCard,
    activeClass:
      "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  },
];

const detectCardBrand = (num) => {
  const clean = String(num || "").replace(/\D/g, "");
  if (clean.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "MASTERCARD";
  if (clean.startsWith("35")) return "JCB";
  if (clean.startsWith("9704")) return "NAPAS DEBIT";
  return "VISA / DEBIT";
};

const formatCardNumberInput = (val) => {
  const digits = String(val || "").replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatExpiryInput = (val) => {
  const digits = String(val || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
};

const PaymentDialog = ({
  showPaymentDialog,
  setShowPaymentDialog,
  setShowReceiptDialog,
}) => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const cart = useSelector(selectCartItems);
  const subTotal = useSelector(selectSubtotal);
  const taxAmount = useSelector(selectTax);
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
  const [copiedField, setCopiedField] = useState(null);

  // State phiên thanh toán bên thứ 3 (MoMo Webhook & Visa 3D-Secure Gateway)
  const [gatewaySession, setGatewaySession] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrMode, setQrMode] = useState("VIETQR"); // "VIETQR" (Chuẩn EMVCo Napas/MoMo) | "MOBILE_GATEWAY" (Cổng Mobile bắn Webhook)
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [cardStepText, setCardStepText] = useState("");
  const orderCompletedRef = useRef(false);

  // State cho thanh toán Thẻ Visa / Ghi nợ (phong cách Google Gemini Pro)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");

  const paymentInfo = store?.paymentInfo || EMPTY_PAYMENT_INFO;

  const enabledMethods = useMemo(() => {
    const filtered = ALL_PAYMENT_METHODS.filter(
      (m) => paymentInfo[m.configKey] !== false,
    );
    return filtered.length > 0 ? filtered : ALL_PAYMENT_METHODS;
  }, [paymentInfo]);

  const normalizedSelected = (paymentMethod || "CASH").toUpperCase();
  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id;

  const isCashierRole = userProfile?.role === "ROLE_BRANCH_CASHIER";
  const needsShift = isCashierRole && !currentShift;

  // Điểm thưởng khách hàng
  const availablePoints = Math.max(
    0,
    Number(selectedCustomer?.loyaltyPoints || 0),
  );
  const isRedeemingPoints = couponCode === "POINTS";
  const pointsUsed = isRedeemingPoints
    ? Math.min(
        availablePoints,
        Math.floor(Math.max(0, subTotal || 0) / VND_PER_POINT_REDEEMED),
      )
    : 0;
  const earnedPoints = selectedCustomer
    ? Math.floor(Math.max(0, total || 0) / VND_PER_POINT_EARNED)
    : 0;
  const projectedPoints = Math.max(
    0,
    availablePoints - pointsUsed + earnedPoints,
  );

  // Tính tiền thừa khi trả tiền mặt
  const numericCashReceived = parseFloat(cashReceived) || 0;
  const changeAmount =
    normalizedSelected === "CASH" && numericCashReceived > total
      ? numericCashReceived - total
      : 0;

  // Thông tin MoMo & Ngân hàng của chủ cửa hàng
  const momoPhone =
    paymentInfo.momoPhone?.trim() || store?.contact?.phone || "0901234567";
  const momoOwnerName =
    paymentInfo.momoOwnerName?.trim() ||
    store?.brand?.toUpperCase() ||
    "POS PRO STORE";
  const storeCardBank = paymentInfo.cardBankName || "MB Bank";
  const storeCardHolder =
    paymentInfo.cardOwnerName ||
    paymentInfo.cardHolderName ||
    momoOwnerName ||
    "POS PRO MERCHANT";
  const storeCardMasked = paymentInfo.cardAccountNumber || paymentInfo.cardNumber
    ? `•••• ${String(paymentInfo.cardAccountNumber || paymentInfo.cardNumber)
        .replace(/\D/g, "")
        .slice(-4)}`
    : "Cổng Visa/Mastercard POS";

  // Hàm hoàn tất tạo đơn hàng (được gọi trực tiếp khi trả Tiền mặt, hoặc TỰ ĐỘNG gọi khi nhận thông báo thành công từ MoMo / Cổng Thẻ Visa)
  const finalizeOrderCreation = useCallback(
    async (thirdPartyInfo = null) => {
      if (orderCompletedRef.current) return;
      if (!cart || cart.length === 0) return;

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

      orderCompletedRef.current = true;
      setProcessing(true);
      try {
        let paymentNote = note || "";
        if (normalizedSelected === "CARD") {
          const txId = thirdPartyInfo?.transactionId || "VISA-3DS-OK";
          const masked =
            thirdPartyInfo?.maskedCardNumber ||
            `•••• ${cardNumber.replace(/\D/g, "").slice(-4)}`;
          const brand = thirdPartyInfo?.cardBrand || detectCardBrand(cardNumber);
          const tag = `[${brand} ${masked} - Mã chuẩn chi: ${txId}]`;
          paymentNote = paymentNote ? `${paymentNote} ${tag}` : tag;
        } else if (normalizedSelected === "UPI") {
          const txId =
            thirdPartyInfo?.transactionId ||
            gatewaySession?.referenceCode ||
            "MOMO-IPN";
          const tag = `[MoMo/VietQR ${momoPhone} - Mã GD: ${txId}]`;
          paymentNote = paymentNote ? `${paymentNote} ${tag}` : tag;
        }

        const orderData = {
          subTotal,
          taxAmount,
          discountAmount,
          couponCode: couponCode || null,
          totalAmount: total,
          branchId: resolvedBranchId,
          cashierId: userProfile?.id,
          customerId: selectedCustomer?.id || null,
          customer: selectedCustomer || null,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            price:
              (item.sellingPrice ?? item.price ?? 0) *
              Number(item.quantity || 1),
          })),
          paymentType: normalizedSelected,
          paymentSessionId:
            thirdPartyInfo?.sessionId || gatewaySession?.sessionId || null,
          note: paymentNote,
        };

        const createdOrder = await dispatch(createOrder(orderData)).unwrap();
        dispatch(resetOrder());
        dispatch(setCurrentOrder(createdOrder));
        dispatch(getInventoryByBranch(resolvedBranchId));
        dispatch(getCurrentShiftProgress());

        setCashReceived("");
        setCardNumber("");
        setCardExpiry("");
        setCardCvv("");
        setCardHolder("");
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
      note,
      normalizedSelected,
      cardNumber,
      gatewaySession,
      momoPhone,
      subTotal,
      taxAmount,
      discountAmount,
      couponCode,
      total,
      userProfile,
      selectedCustomer,
      dispatch,
      setShowPaymentDialog,
      setShowReceiptDialog,
      toast,
    ],
  );

  // Khởi tạo phiên thanh toán bên thứ 3 (Payment Session) khi chọn MoMo QR hoặc Thẻ Visa/Debit
  const initGatewaySession = useCallback(
    async (methodType) => {
      if (!showPaymentDialog || methodType === "CASH" || !total || total <= 0) {
        setGatewaySession(null);
        return;
      }
      setCreatingSession(true);
      orderCompletedRef.current = false;
      try {
        const res = await api.post("/api/payment-gateway/sessions", {
          storeId: store?.id || null,
          storeName: store?.brand || "POS Pro Store",
          amount: Math.round(total || 0),
          method: methodType === "UPI" ? "MOMO" : "CARD",
          recipientPhone: momoPhone,
          recipientName: momoOwnerName,
          bankName: storeCardBank,
          bankAccount:
            paymentInfo.cardAccountNumber ||
            paymentInfo.cardNumber ||
            momoPhone,
        });
        setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      } catch (err) {
        console.error("Failed to create payment gateway session:", err);
      } finally {
        setCreatingSession(false);
      }
    },
    [
      showPaymentDialog,
      total,
      store,
      momoPhone,
      momoOwnerName,
      storeCardBank,
      paymentInfo,
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
      setGatewaySession(null);
      setCardStepText("");
    }
  }, [showPaymentDialog, normalizedSelected, initGatewaySession]);

  // Cơ chế Long-Polling / Lắng nghe thông báo IPN Webhook thời gian thực từ bên thứ 3 (MoMo / Napas247)
  useEffect(() => {
    if (
      !showPaymentDialog ||
      normalizedSelected !== "UPI" ||
      !gatewaySession?.sessionId ||
      gatewaySession.status === "SUCCESS" ||
      gatewaySession.status === "FAILED"
    ) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await api.get(
          `/api/payment-gateway/sessions/${gatewaySession.sessionId}`,
        );
        const updated = res.data;
        if (updated && updated.status !== gatewaySession.status) {
          setGatewaySession((prev) => (updated ? { ...updated, webhookToken: updated.webhookToken || prev?.webhookToken } : updated));
          if (updated.status === "SUCCESS" && !orderCompletedRef.current) {
            clearInterval(timer);
            finalizeOrderCreation(updated);
          }
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời khi đang polling
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [
    showPaymentDialog,
    normalizedSelected,
    gatewaySession,
    finalizeOrderCreation,
  ]);

  // Hàm giả lập / kích hoạt thông báo IPN Webhook từ MoMo gửi về Backend (để test ngay trên 1 máy tính hoặc khi KH đã chuyển khoản xong)
  const handleTriggerMomoWebhook = async (status = "SUCCESS") => {
    if (!gatewaySession?.sessionId) return;
    setSimulatingWebhook(true);
    try {
      const res = await api.post(
        `/api/payment-gateway/webhook/${gatewaySession.sessionId}`,
        {
          status,
          providerName: "MoMo / Napas247 IPN Webhook",
        },
        {
          headers: {
            "X-Webhook-Signature": gatewaySession?.webhookToken || "",
          },
        },
      );
      setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      if (res.data?.status === "SUCCESS" && !orderCompletedRef.current) {
        await finalizeOrderCreation(res.data);
      }
    } catch (err) {
      toast({
        title: "Lỗi kết nối Webhook",
        description:
          err?.response?.data?.message || "Không thể gửi tín hiệu Webhook.",
        variant: "destructive",
      });
    } finally {
      setSimulatingWebhook(false);
    }
  };

  // Gửi yêu cầu thanh toán Thẻ Visa/Debit tới Cổng 3D-Secure của bên thứ 3 và chờ thông báo chuẩn chi
  const handleAuthorizeCardGateway = async () => {
    if (needsShift) {
      toast({
        title: "Chưa mở ca làm việc",
        description: "Vui lòng bấm 'Mở ca ngay' trước khi thực hiện giao dịch.",
        variant: "destructive",
      });
      return;
    }

    let currentSessionId = gatewaySession?.sessionId;
    if (!currentSessionId) {
      const res = await api.post("/api/payment-gateway/sessions", {
        storeId: store?.id || null,
        storeName: store?.brand || "POS Pro Store",
        amount: Math.round(total || 0),
        method: "CARD",
      });
      setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      currentSessionId = res.data.sessionId;
    }

    setProcessing(true);
    setCardStepText("Đang kết nối cổng thanh toán quốc tế Visa / Mastercard...");
    try {
      await new Promise((r) => setTimeout(r, 600));
      setCardStepText(
        "Đang xác thực bảo mật 3D-Secure & kiểm tra hạn mức thẻ với ngân hàng phát hành...",
      );
      await new Promise((r) => setTimeout(r, 700));

      const res = await api.post(
        `/api/payment-gateway/sessions/${currentSessionId}/authorize-card`,
        {
          cardNumber,
          expiry: cardExpiry,
          cvv: cardCvv,
          cardHolder,
        },
      );

      const updatedSession = res.data;
      setGatewaySession((prev) => (updatedSession ? { ...updatedSession, webhookToken: updatedSession.webhookToken || prev?.webhookToken } : updatedSession));

      if (updatedSession.status === "SUCCESS") {
        setCardStepText(
          `Ngân hàng xác nhận thành công (Mã chuẩn chi: ${updatedSession.transactionId}). Đang hoàn tất đơn hàng...`,
        );
        await finalizeOrderCreation(updatedSession);
      }
    } catch (err) {
      const failedSession = err?.response?.data;
      if (failedSession) {
        setGatewaySession((prev) => (failedSession ? { ...failedSession, webhookToken: failedSession.webhookToken || prev?.webhookToken } : failedSession));
      }
      toast({
        title: "Cổng thanh toán Thẻ từ chối giao dịch",
        description:
          failedSession?.providerMessage ||
          "Thông tin thẻ không hợp lệ hoặc ngân hàng phát hành từ chối.",
        variant: "destructive",
      });
      setProcessing(false);
      setCardStepText("");
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(String(text));
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleSelectPaymentMethod = (methodId) => {
    dispatch(setPaymentMethod(methodId));
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

  const handleFillSampleCard = () => {
    setCardNumber("4221 5678 9012 4829");
    setCardExpiry("08/29");
    setCardCvv("889");
    setCardHolder(
      (selectedCustomer?.fullName || "NGUYEN VAN KHACH").toUpperCase(),
    );
  };

  const detectedBrand = detectCardBrand(cardNumber);

  // URL ảnh QR chuẩn EMVCo VietQR (luôn hợp lệ khi quét bằng mọi App Ngân hàng / MoMo)
  const fallbackVietQrUrl = `https://img.vietqr.io/image/970422-${String(
    momoPhone,
  ).replace(/\D/g, "")}-compact2.png?amount=${Math.round(
    total || 0,
  )}&addInfo=${encodeURIComponent(
    gatewaySession?.referenceCode || "POS THANH TOAN",
  )}&accountName=${encodeURIComponent(momoOwnerName)}`;

  const activeQrImageUrl =
    paymentInfo.momoQrImage?.trim() ||
    (qrMode === "MOBILE_GATEWAY" && gatewaySession?.qrImageForMobileCheckout
      ? gatewaySession.qrImageForMobileCheckout
      : gatewaySession?.vietQrImageUrl || fallbackVietQrUrl);

  return (
    <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between pr-4">
            <span>Thanh toán Đơn hàng</span>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            >
              ₫{Number(total || 0).toLocaleString("vi-VN")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Cảnh báo nếu thu ngân chưa mở ca */}
          {needsShift && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Chưa bắt đầu ca làm việc</div>
                  <div className="opacity-90">
                    Bấm mở ca ngay tại đây để hệ thống ghi nhận doanh thu ca của
                    bạn.
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleQuickStartShift}
                disabled={startingShift}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs"
              >
                {startingShift ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <PlayCircle className="w-3.5 h-3.5 mr-1" />
                )}
                Mở ca ngay
              </Button>
            </div>
          )}

          {/* Tóm tắt số tiền thanh toán */}
          <div className="rounded-lg bg-muted/60 p-3 space-y-1.5 border text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Tạm tính ({cart.length} mặt hàng):</span>
              <span>₫{Number(subTotal || 0).toLocaleString("vi-VN")}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Thuế VAT (10%):</span>
              <span>₫{Number(taxAmount || 0).toLocaleString("vi-VN")}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600 font-medium">
                <span>
                  Giảm giá{" "}
                  {isRedeemingPoints
                    ? `(Đổi ${pointsUsed} điểm)`
                    : couponCode
                      ? `(${couponCode})`
                      : ""}
                  :
                </span>
                <span>
                  -₫{Number(discountAmount || 0).toLocaleString("vi-VN")}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center text-base font-bold pt-0.5">
              <span>Tổng thanh toán:</span>
              <span className="text-xl text-emerald-600">
                ₫{Number(total || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>

          {/* Thông tin tích điểm & đổi điểm của Khách hàng */}
          {selectedCustomer && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  {selectedCustomer.fullName || selectedCustomer.name}
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1"
                >
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  Hiện có: {availablePoints} điểm
                </Badge>
              </div>

              {pointsUsed > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    Điểm sử dụng đơn này:
                  </span>
                  <span>
                    -{pointsUsed} điểm (-
                    {(pointsUsed * VND_PER_POINT_REDEEMED).toLocaleString(
                      "vi-VN",
                    )}
                    ₫)
                  </span>
                </div>
              )}

              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Điểm tích lũy thêm:
                </span>
                <span>+{earnedPoints} điểm</span>
              </div>

              <div className="flex justify-between pt-1 border-t border-amber-500/20 font-semibold text-foreground">
                <span>Số dư điểm sau thanh toán:</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {projectedPoints} điểm
                </span>
              </div>
            </div>
          )}

          {/* Chọn phương thức thanh toán */}
          <div className="space-y-2">
            <label className="text-sm font-semibold block">
              Chọn phương thức thanh toán
            </label>
            <div className="grid grid-cols-3 gap-2">
              {enabledMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = normalizedSelected === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handleSelectPaymentMethod(method.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? `${method.activeClass} ring-2 ring-current font-semibold shadow-xs`
                        : "hover:bg-muted/60 border-border text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs leading-tight">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================================================================= */}
          {/* 1. GIAO DIỆN TIỀN MẶT (CASH) - DUY NHẤT CÓ NÚT XÁC NHẬN ĐÃ NHẬN TIỀN */}
          {/* ================================================================= */}
          {normalizedSelected === "CASH" && (
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2.5">
              <label className="text-xs font-semibold text-muted-foreground block">
                Tiền mặt khách đưa (Nhập hoặc chọn nhanh mệnh giá)
              </label>
              <Input
                type="number"
                min="0"
                placeholder={`Nhập số tiền khách đưa (≥ ${Number(total || 0).toLocaleString("vi-VN")}₫)`}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  Math.ceil(total || 0),
                  100000,
                  200000,
                  500000,
                  1000000,
                ]
                  .filter(
                    (v, idx, arr) =>
                      v >= (total || 0) && arr.indexOf(v) === idx,
                  )
                  .slice(0, 4)
                  .map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCashReceived(String(preset))}
                      className="text-xs px-2.5 py-1 rounded-md border bg-background hover:bg-emerald-500/10 hover:border-emerald-500/40 font-medium transition-colors"
                    >
                      {preset === Math.ceil(total || 0)
                        ? "Đủ tiền"
                        : `${(preset / 1000).toLocaleString("vi-VN")}k`}
                    </button>
                  ))}
              </div>
              {numericCashReceived >= total && total > 0 && (
                <div className="flex justify-between items-center text-sm font-bold text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                  <span>Tiền thừa trả khách:</span>
                  <span>₫{changeAmount.toLocaleString("vi-VN")}</span>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. GIAO DIỆN QUÉT MÃ QR MOMO / VIETQR (NHẬN WEBHOOK TỰ ĐỘNG)      */}
          {/* ================================================================= */}
          {normalizedSelected === "UPI" && (
            <div className="rounded-xl border-2 border-[#A50064]/40 bg-gradient-to-b from-[#A50064]/10 via-background to-background p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#A50064] text-white font-black text-[10px] leading-none flex items-center justify-center shadow-xs">
                    mo
                    <br />
                    mo
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#A50064] dark:text-pink-400">
                      Quét Mã QR MoMo / Chuẩn EMVCo VietQR
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Tự động hoàn tất đơn ngay khi nhận thông báo IPN từ bên thứ 3
                    </div>
                  </div>
                </div>

                {/* Chuyển đổi chuẩn QR để tương thích mọi trình quét */}
                <div className="flex rounded-lg border bg-muted/50 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setQrMode("VIETQR")}
                    className={`px-2 py-1 rounded-md font-semibold transition-all ${
                      qrMode === "VIETQR"
                        ? "bg-[#A50064] text-white shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Chuẩn VietQR / MoMo
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode("MOBILE_GATEWAY")}
                    className={`px-2 py-1 rounded-md font-semibold transition-all ${
                      qrMode === "MOBILE_GATEWAY"
                        ? "bg-[#A50064] text-white shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    QR Cổng Mobile
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border shadow-xs">
                <div className="relative shrink-0 flex flex-col items-center">
                  {creatingSession ? (
                    <div className="w-44 h-44 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#A50064]/30 bg-muted/20">
                      <Loader2 className="w-7 h-7 animate-spin text-[#A50064]" />
                      <span className="text-[11px] text-muted-foreground mt-2">
                        Đang tạo mã QR...
                      </span>
                    </div>
                  ) : (
                    <img
                      src={activeQrImageUrl}
                      alt="MoMo VietQR Payment"
                      className="w-44 h-44 object-contain rounded-lg border-2 border-[#A50064]/30 p-1 bg-white"
                    />
                  )}
                  <div className="mt-1.5 text-center text-[11px] font-semibold text-[#A50064] flex items-center justify-center gap-1">
                    <QrCode className="w-3 h-3" />
                    {qrMode === "VIETQR"
                      ? "Quét bằng App Ngân hàng / MoMo"
                      : "Quét bằng Camera ĐT / Zalo"}
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Chủ tài khoản / Ví thụ hưởng
                      </div>
                      <div className="font-bold text-foreground">
                        {momoOwnerName}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {gatewaySession?.bankName || storeCardBank}
                    </Badge>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        SĐT Ví MoMo / Số TK nhận
                      </div>
                      <div className="font-mono font-bold text-sm text-[#A50064] dark:text-pink-400">
                        {momoPhone}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCopy(momoPhone, "phone")}
                    >
                      {copiedField === "phone" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Số tiền & Mã đối soát tự động
                      </div>
                      <div className="font-bold text-emerald-600">
                        ₫{Number(total || 0).toLocaleString("vi-VN")} •{" "}
                        <span className="font-mono text-foreground">
                          {gatewaySession?.referenceCode || "POS..."}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        handleCopy(gatewaySession?.referenceCode || "", "ref")
                      }
                    >
                      {copiedField === "ref" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Trạng thái lắng nghe thông báo từ Bên thứ 3 (IPN Webhook Listener) */}
              <div className="rounded-xl border border-[#A50064]/30 bg-[#A50064]/5 p-3 space-y-2.5">
                {gatewaySession?.status === "SUCCESS" ? (
                  <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div>
                        Đã nhận thông báo thanh toán thành công từ MoMo!
                      </div>
                      <div className="text-[11px] font-normal opacity-90">
                        {gatewaySession.providerMessage} — Đang tự động xuất hóa
                        đơn...
                      </div>
                    </div>
                  </div>
                ) : gatewaySession?.status === "FAILED" ? (
                  <div className="flex items-center justify-between gap-2 text-red-600 text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {gatewaySession.providerMessage ||
                          "Giao dịch bị hủy hoặc thất bại."}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => initGatewaySession("UPI")}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Tạo mã QR mới
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#A50064] dark:text-pink-300">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A50064] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#A50064]"></span>
                        </span>
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>
                          Đang chờ thông báo nhận tiền (IPN Webhook) từ MoMo...
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {gatewaySession?.sessionId || "Đang khởi tạo..."}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      Hệ thống sẽ <strong>tự động tạo đơn & in hóa đơn</strong>{" "}
                      ngay khi nhận được callback báo có tiền từ cổng MoMo /
                      Napas247 (không cần thu ngân bấm xác nhận tiền mặt).
                    </div>

                    {/* Thanh công cụ kiểm thử & mở cổng xác nhận bên thứ 3 */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#A50064]/15">
                      {gatewaySession?.mobileCheckoutUrl && (
                        <a
                          href={gatewaySession.mobileCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#A50064]/30 bg-background hover:bg-[#A50064]/10 text-[#A50064] dark:text-pink-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Mở trang Cổng MoMo (Test trên trình duyệt)
                        </a>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          simulatingWebhook ||
                          !gatewaySession?.sessionId ||
                          needsShift
                        }
                        onClick={() => handleTriggerMomoWebhook("SUCCESS")}
                        className="h-7 text-[11px] bg-[#A50064] hover:bg-[#8d0055] text-white ml-auto"
                      >
                        {simulatingWebhook ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3 mr-1" />
                        )}
                        Giả lập Webhook MoMo báo nhận tiền thành công
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. GIAO DIỆN CỔNG THẺ VISA / GHI NỢ (TỰ ĐỘNG XÁC THỰC 3D-SECURE)  */}
          {/* ================================================================= */}
          {normalizedSelected === "CARD" && (
            <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-500/5 via-background to-background p-4 space-y-3.5">
              {/* Header kiểu Google Pay / Gemini Pro */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-600 text-white">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      Cổng thanh toán Thẻ Visa / Thẻ ghi nợ (3D-Secure)
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Thụ hưởng: {storeCardHolder} ({storeCardBank} •{" "}
                      {storeCardMasked})
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillSampleCard}
                    className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                  >
                    Điền thẻ mẫu
                  </Button>
                </div>
              </div>

              {/* Form nhập thẻ giống Google Gemini Pro Checkout */}
              <div className="space-y-3 bg-card p-3.5 rounded-xl border shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Số thẻ (Card number) *
                    </label>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 h-4 font-bold text-blue-600 border-blue-500/30"
                    >
                      {detectedBrand}
                    </Badge>
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="4221 •••• •••• ••••"
                      value={cardNumber}
                      disabled={processing}
                      onChange={(e) =>
                        setCardNumber(formatCardNumberInput(e.target.value))
                      }
                      className="pr-12 font-mono tracking-wider"
                    />
                    <CreditCard className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">
                      Ngày hết hạn (MM/YY) *
                    </label>
                    <Input
                      placeholder="MM/YY"
                      value={cardExpiry}
                      disabled={processing}
                      onChange={(e) =>
                        setCardExpiry(formatExpiryInput(e.target.value))
                      }
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">
                      Mã bảo mật (CVV/CVC) *
                    </label>
                    <div className="relative">
                      <Input
                        type="password"
                        maxLength={4}
                        placeholder="3-4 số (000 = test lỗi)"
                        value={cardCvv}
                        disabled={processing}
                        onChange={(e) =>
                          setCardCvv(
                            e.target.value.replace(/\D/g, "").slice(0, 4),
                          )
                        }
                        className="font-mono pr-8"
                      />
                      <Lock className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block">
                    Tên trên thẻ (Cardholder name) *
                  </label>
                  <Input
                    placeholder="NGUYEN VAN A"
                    value={cardHolder}
                    disabled={processing}
                    onChange={(e) =>
                      setCardHolder(e.target.value.toUpperCase())
                    }
                    className="uppercase tracking-wide"
                  />
                </div>

                {/* Trạng thái phản hồi từ Cổng Thẻ Ngân Hàng phát hành */}
                {cardStepText && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
                    <span>{cardStepText}</span>
                  </div>
                )}

                {gatewaySession?.status === "FAILED" && !processing && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 flex items-center gap-2 text-xs text-red-600 font-medium">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{gatewaySession.providerMessage}</span>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleAuthorizeCardGateway}
                  disabled={processing || cart.length === 0 || needsShift}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang chờ thông báo chuẩn chi từ Ngân hàng...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Gửi yêu cầu trừ tiền qua Cổng Thẻ (₫
                      {Number(total || 0).toLocaleString("vi-VN")})
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Đơn hàng sẽ tự động hoàn tất ngay khi Cổng Visa / Mastercard
                    phản hồi chuẩn chi thành công.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER: Chỉ hiển thị nút xác nhận thu tiền trực tiếp khi chọn TIỀN MẶT (CASH) */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPaymentDialog(false)}
            disabled={processing}
          >
            Đóng / Hủy giao dịch
          </Button>

          {normalizedSelected === "CASH" && (
            <Button
              type="button"
              onClick={() => finalizeOrderCreation()}
              disabled={processing || cart.length === 0 || needsShift}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4 mr-2" />
                  Đã nhận tiền mặt ₫{Number(total || 0).toLocaleString("vi-VN")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
