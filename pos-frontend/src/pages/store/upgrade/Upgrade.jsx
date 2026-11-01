import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  CheckCircle,
  Store,
  Users,
  ShoppingCart,
  Info,
  Star,
  CreditCard,
  Smartphone,
  Lock,
  ShieldCheck,
  QrCode,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Radio,
  ExternalLink,
  Zap,
  XCircle,
  RefreshCw,
} from "lucide-react";
import api from "@/utils/api";
import { getAllSubscriptionPlans } from "../../../Redux Toolkit/features/subscriptionPlan/subscriptionPlanThunks";
import {
  subscribeToPlan,
  upgradeSubscription,
  getStoreSubscriptions,
} from "../../../Redux Toolkit/features/subscription/subscriptionThunks";
import { useToast } from "@/components/ui/use-toast";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";

// Tính năng cố định của gói (đồng bộ với PlanFeature ở backend)
const PLAN_FEATURES = [
  { key: "advancedReports", label: "Advanced Reports" },
  { key: "inventory", label: "Inventory System" },
  { key: "multiLocation", label: "Multi-location" },
  { key: "invoiceBranding", label: "Invoice Branding" },
  { key: "integrations", label: "Integrations" },
  { key: "ecommerce", label: "eCommerce" },
  { key: "prioritySupport", label: "Priority Support" },
  { key: "aiCopilot", label: "AI Copilot & Smart POS" },
];
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

const detectCardBrand = (num) => {
  const clean = String(num || "").replace(/\D/g, "");
  if (clean.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "MASTERCARD";
  if (clean.startsWith("35")) return "JCB";
  return "VISA / DEBIT";
};

const Upgrade = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const {
    plans,
    loading: plansLoading,
    error: plansError,
  } = useSelector((state) => state.subscriptionPlan);
  const {
    subscriptions,
    loading: subLoading,
    error: subError,
  } = useSelector((state) => state.subscription);
  const { store } = useSelector((state) => state.store);

  const { entitlements, refresh: refreshEntitlements } = usePlanEntitlements();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // State cho Dialog Thanh toán Gói cước (phong cách Gemini Pro + Third-party Gateway)
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("VISA"); // VISA | MOMO
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [billingAddress, setBillingAddress] = useState("Việt Nam");
  const [copiedField, setCopiedField] = useState(null);

  // State phiên thanh toán bên thứ 3
  const [gatewaySession, setGatewaySession] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrMode, setQrMode] = useState("VIETQR");
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [cardStepText, setCardStepText] = useState("");
  const [platformConfig, setPlatformConfig] = useState(null);
  const subCompletedRef = useRef(false);

  const currentSubscription = subscriptions?.find(
    (sub) =>
      (sub.storeId === store?.id || sub.store?.id === store?.id) &&
      (sub.status === "ACTIVE" || sub.status === "TRIAL"),
  );

  const isCurrentPlan = (plan) => {
    if (!currentSubscription || !plan) return false;
    return (
      String(currentSubscription.planId) === String(plan.id) ||
      currentSubscription.plan?.id === plan.id ||
      currentSubscription.planName?.toLowerCase() === plan.name?.toLowerCase()
    );
  };

  useEffect(() => {
    dispatch(getAllSubscriptionPlans());
    if (store?.id) {
      dispatch(
        getStoreSubscriptions({ storeId: store.id }),
      );
    }
    api
      .get("/api/payment-gateway/platform-config")
      .then((res) => {
        if (res.data) {
          setPlatformConfig(res.data);
          if (res.data.acceptCard === false && res.data.acceptMomo !== false) {
            setPaymentMethod("MOMO");
          }
        }
      })
      .catch(() => {});
  }, [dispatch, store?.id]);

  const platformMomoPhone =
    platformConfig?.momoPhone?.trim() || "0901234567";
  const platformMomoOwner =
    platformConfig?.momoOwnerName?.trim() || "POS PRO ENTERPRISE SAAS";
  const platformBankName =
    platformConfig?.cardBankName?.trim() || "Vietcombank - Visa";
  const platformCardHolder =
    platformConfig?.cardHolderName?.trim() || platformMomoOwner;
  const platformCardMasked = platformConfig?.cardNumber
    ? `•••• ${String(platformConfig.cardNumber).replace(/\D/g, "").slice(-4)}`
    : "Cổng Visa/Mastercard POS Admin";

  // Kích hoạt gói cước tự động sau khi Cổng thanh toán bên thứ 3 báo SUCCESS
  const finalizeSubscriptionActivation = useCallback(
    async (verifiedSession) => {
      if (subCompletedRef.current || !store?.id || !selectedPlan) return;
      subCompletedRef.current = true;
      setActionLoading(true);
      setActionError(null);

      const transactionId =
        verifiedSession?.transactionId ||
        `${paymentMethod}-${Date.now().toString().slice(-6)}`;

      try {
        if (currentSubscription) {
          await dispatch(
            upgradeSubscription({
              storeId: store.id,
              planId: selectedPlan.id,
              gateway: paymentMethod,
              transactionId,
            }),
          ).unwrap();
          setSuccessMsg(
            `Đã nhận thông báo thanh toán! Nâng cấp thành công lên gói "${selectedPlan.name}" (Mã GD: ${transactionId}).`,
          );
        } else {
          await dispatch(
            subscribeToPlan({
              storeId: store.id,
              planId: selectedPlan.id,
              gateway: paymentMethod,
              transactionId,
            }),
          ).unwrap();
          setSuccessMsg(
            `Đã nhận thông báo thanh toán! Đăng ký thành công gói "${selectedPlan.name}" (Mã GD: ${transactionId}).`,
          );
        }
        dispatch(
          getStoreSubscriptions({ storeId: store.id }),
        );
        refreshEntitlements();
        setCheckoutOpen(false);
        setCardNumber("");
        setCardExpiry("");
        setCardCvv("");
        setCardHolder("");
        toast({
          title: "Kích hoạt gói cước tự động thành công!",
          description: `Cổng thanh toán đã xác nhận giao dịch ${transactionId}.`,
        });
      } catch (err) {
        subCompletedRef.current = false;
        const errMsg =
          (err && err.message) || err || "Failed to subscribe/upgrade.";
        setActionError(errMsg);
        toast({
          title: "Không thể kích hoạt gói cước",
          description: errMsg,
          variant: "destructive",
        });
      } finally {
        setActionLoading(false);
      }
    },
    [
      store?.id,
      selectedPlan,
      paymentMethod,
      currentSubscription,
      dispatch,
      toast,
      refreshEntitlements,
    ],
  );

  const initSubscriptionGatewaySession = useCallback(
    async (methodType) => {
      if (!checkoutOpen || !selectedPlan || Number(selectedPlan.price || 0) <= 0) {
        setGatewaySession(null);
        return;
      }
      setCreatingSession(true);
      subCompletedRef.current = false;
      try {
        const res = await api.post("/api/payment-gateway/sessions", {
          storeId: null,
          storeName: `POS Pro SaaS (${selectedPlan.name})`,
          amount: Math.max(1000, Math.round(selectedPlan.price || 100000)),
          method: methodType === "MOMO" ? "MOMO" : "CARD",
          recipientPhone: platformMomoPhone,
          recipientName: platformMomoOwner,
          bankName: platformBankName,
          bankAccount: platformConfig?.cardNumber?.trim() || platformMomoPhone,
        });
        setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      } catch (e) {
        console.error("Failed to create subscription payment session:", e);
      } finally {
        setCreatingSession(false);
      }
    },
    [
      checkoutOpen,
      selectedPlan,
      platformMomoPhone,
      platformMomoOwner,
      platformBankName,
      platformConfig?.cardNumber,
    ],
  );

  useEffect(() => {
    if (checkoutOpen && selectedPlan) {
      initSubscriptionGatewaySession(paymentMethod);
    } else {
      setGatewaySession(null);
      setCardStepText("");
    }
  }, [checkoutOpen, selectedPlan, paymentMethod, initSubscriptionGatewaySession]);

  // Lắng nghe thông báo IPN Webhook thời gian thực khi chọn MoMo QR
  useEffect(() => {
    if (
      !checkoutOpen ||
      paymentMethod !== "MOMO" ||
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
          if (updated.status === "SUCCESS" && !subCompletedRef.current) {
            clearInterval(timer);
            finalizeSubscriptionActivation(updated);
          }
        }
      } catch {
        // ignore transient network error
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [
    checkoutOpen,
    paymentMethod,
    gatewaySession,
    finalizeSubscriptionActivation,
  ]);

  const handleTriggerMomoWebhook = async () => {
    if (!gatewaySession?.sessionId) return;
    setSimulatingWebhook(true);
    try {
      const res = await api.post(
        `/api/payment-gateway/webhook/${gatewaySession.sessionId}`,
        {
          status: "SUCCESS",
          providerName: "MoMo SaaS Billing IPN",
        },
        {
          headers: {
            "X-Webhook-Signature": gatewaySession?.webhookToken || "",
          },
        },
      );
      setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      if (res.data?.status === "SUCCESS" && !subCompletedRef.current) {
        await finalizeSubscriptionActivation(res.data);
      }
    } catch {
      toast({
        title: "Lỗi kết nối Webhook",
        description: "Không thể gửi tín hiệu Webhook.",
        variant: "destructive",
      });
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const handleAuthorizeCardSubscription = async () => {
    let currentSessionId = gatewaySession?.sessionId;
    if (!currentSessionId) {
      const res = await api.post("/api/payment-gateway/sessions", {
        storeName: `POS Pro SaaS (${selectedPlan?.name})`,
        amount: Math.max(1000, Math.round(selectedPlan?.price || 100000)),
        method: "CARD",
      });
      setGatewaySession((prev) => (res.data ? { ...res.data, webhookToken: res.data.webhookToken || prev?.webhookToken } : res.data));
      currentSessionId = res.data.sessionId;
    }

    setActionLoading(true);
    setCardStepText("Đang kết nối cổng thanh toán quốc tế Visa / Mastercard...");
    try {
      await new Promise((r) => setTimeout(r, 600));
      setCardStepText(
        "Đang xác thực 3D-Secure & chờ thông báo chuẩn chi từ ngân hàng phát hành...",
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
      const updated = res.data;
      setGatewaySession((prev) => (updated ? { ...updated, webhookToken: updated.webhookToken || prev?.webhookToken } : updated));
      if (updated.status === "SUCCESS") {
        setCardStepText(
          `Ngân hàng xác nhận thành công (${updated.transactionId}). Đang kích hoạt gói cước...`,
        );
        await finalizeSubscriptionActivation(updated);
      } else {
        setActionLoading(false);
        setCardStepText("");
        toast({
          title: "Cổng thanh toán Thẻ từ chối giao dịch",
          description:
            updated?.providerMessage ||
            "Thông tin thẻ không hợp lệ hoặc bị ngân hàng từ chối.",
          variant: "destructive",
        });
      }
    } catch (err) {
      const failed = err?.response?.data;
      if (failed) setGatewaySession((prev) => ({ ...failed, webhookToken: failed.webhookToken || prev?.webhookToken }));
      toast({
        title: "Cổng thanh toán Thẻ từ chối giao dịch",
        description:
          failed?.providerMessage ||
          "Thông tin thẻ không hợp lệ hoặc ngân hàng từ chối.",
        variant: "destructive",
      });
      setActionLoading(false);
      setCardStepText("");
    }
  };

  // Không cho chọn gói có giới hạn thấp hơn mức cửa hàng đang dùng (tránh thanh toán rồi mới bị từ chối)
  const getSwitchBlocker = (plan) => {
    const e = entitlements;
    if (!e || !plan) return null;
    if (plan.maxBranches > 0 && e.usedBranches > plan.maxBranches) {
      return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxBranches} chi nhánh nhưng cửa hàng đang có ${e.usedBranches}. Hãy xóa bớt chi nhánh trước.`;
    }
    if (!plan.multiLocation && e.usedBranches > 1) {
      return `Gói "${plan.name}" không có Multi-location (chỉ 1 chi nhánh) nhưng cửa hàng đang có ${e.usedBranches} chi nhánh.`;
    }
    if (plan.maxUsers > 0 && e.usedUsers > plan.maxUsers) {
      return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxUsers} nhân sự nhưng cửa hàng đang có ${e.usedUsers}. Hãy xóa bớt nhân sự trước.`;
    }
    if (plan.maxProducts > 0 && e.usedProducts > plan.maxProducts) {
      return `Gói "${plan.name}" chỉ cho tối đa ${plan.maxProducts} sản phẩm nhưng cửa hàng đang có ${e.usedProducts}. Hãy xóa bớt sản phẩm trước.`;
    }
    return null;
  };

  const handleOpenCheckout = (plan) => {
    const blocker = getSwitchBlocker(plan);
    if (blocker) {
      setActionError(blocker);
      setSuccessMsg(null);
      toast({
        title: "Không thể chuyển sang gói này",
        description: blocker,
        variant: "destructive",
      });
      return;
    }    setSelectedPlan(plan);
    setActionError(null);
    setSuccessMsg(null);
    setCheckoutOpen(true);
  };

  const handleCopy = (val, key) => {
    navigator.clipboard?.writeText(String(val));
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fallbackVietQrUrl = `https://img.vietqr.io/image/970422-${platformMomoPhone}-compact2.png?amount=${Math.max(
    1000,
    Math.round(selectedPlan?.price || 0),
  )}&addInfo=${encodeURIComponent(
    gatewaySession?.referenceCode || "POS PRO SUB",
  )}&accountName=${encodeURIComponent(platformMomoOwner)}`;

  const activeQrUrl =
    platformConfig?.momoQrImage?.trim() ||
    (qrMode === "MOBILE_GATEWAY" && gatewaySession?.qrImageForMobileCheckout
      ? gatewaySession.qrImageForMobileCheckout
      : gatewaySession?.vietQrImageUrl || fallbackVietQrUrl);

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="text-center mb-8 space-y-2">
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30 px-3 py-1"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          POS Pro Cloud Subscription
        </Badge>
        <h1 className="text-3xl font-bold">
          Nâng cấp Gói cước Cửa hàng (Subscription Plans)
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Thanh toán trực tuyến an toàn qua Thẻ quốc tế Visa / Mastercard / Thẻ
          ghi nợ hoặc quét mã QR chuẩn EMVCo VietQR / MoMo (tự động kích hoạt
          khi nhận thông báo từ cổng thanh toán).
        </p>
      </div>

      {plansLoading || subLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : plansError || subError ? (
        <div className="text-center text-red-500 py-8">
          {plansError || subError}
        </div>
      ) : (
        <>
          {currentSubscription && (
            <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-foreground flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold">
                    Gói hiện tại:{" "}
                    {currentSubscription.planName ||
                      currentSubscription.plan?.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Trạng thái: {currentSubscription.status} | Hết hạn:{" "}
                    {currentSubscription.endDate
                      ? new Date(
                          currentSubscription.endDate,
                        ).toLocaleDateString("vi-VN")
                      : "—"}
                  </div>
                </div>
              </div>
              {currentSubscription.transactionId && (
                <Badge variant="outline" className="font-mono text-xs">
                  Mã GD: {currentSubscription.transactionId}
                </Badge>
              )}
            </div>
          )}

          {actionError && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-center text-red-600 text-sm font-medium">
              {actionError}
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center text-emerald-600 text-sm font-semibold">
              {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans?.map((plan) => {
              const activePlan = isCurrentPlan(plan);
              return (
                <div
                  key={plan.id}
                  className={`bg-card rounded-2xl p-8 shadow-lg border relative flex flex-col ${
                    activePlan ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {activePlan && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                        Gói đang dùng
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-foreground">
                        ₫{Number(plan.price || 0).toLocaleString("vi-VN")}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        /{plan.billingCycle?.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {plan.description && (
                      <li className="text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        {plan.description}
                      </li>
                    )}
                    {plan.maxBranches && (
                      <li className="text-muted-foreground flex items-center gap-2">
                        <Store className="w-5 h-5 text-purple-500 flex-shrink-0" />
                        Tối đa Chi nhánh: {plan.maxBranches}
                      </li>
                    )}
                    {plan.maxUsers && (
                      <li className="text-muted-foreground flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        Tối đa Nhân sự: {plan.maxUsers}
                      </li>
                    )}
                    {plan.maxProducts && (
                      <li className="text-muted-foreground flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-green-500 flex-shrink-0" />
                        Tối đa Sản phẩm: {plan.maxProducts}
                      </li>
                    )}
                    <li className="pt-2 border-t">
                      <ul className="space-y-1.5">
                        {PLAN_FEATURES.map((f) => {
                          const on = Boolean(plan[f.key]);
                          return (
                            <li
                              key={f.key}
                              className={`flex items-center gap-2 text-sm ${
                                on
                                  ? "text-foreground"
                                  : "text-muted-foreground line-through opacity-60"
                              }`}
                            >
                              {on ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              {f.label}
                            </li>
                          );
                        })}
                      </ul>
                    </li>                  </ul>
                  <Button
                    className="w-full mt-auto"
                    variant={activePlan ? "outline" : "default"}
                    size="default"
                    disabled={actionLoading || activePlan}
                    onClick={() => handleOpenCheckout(plan)}
                  >
                    {activePlan
                      ? "Đang sử dụng gói này"
                      : currentSubscription
                        ? "Nâng cấp lên gói này"
                        : "Đăng ký ngay"}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* DIALOG THANH TOÁN ĐĂNG KÝ GÓI CƯỚC (TỰ ĐỘNG NHẬN THÔNG BÁO TỪ BÊN THỨ 3) */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Đăng ký POS Pro — {selectedPlan?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-foreground">
                    Gói {selectedPlan.name} ({selectedPlan.billingCycle})
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {selectedPlan.maxBranches} chi nhánh •{" "}
                    {selectedPlan.maxUsers} nhân viên •{" "}
                    {selectedPlan.maxProducts} sản phẩm
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                    ₫{Number(selectedPlan.price || 0).toLocaleString("vi-VN")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    /{selectedPlan.billingCycle?.toLowerCase()}
                  </div>
                </div>
              </div>

              {Number(selectedPlan.price || 0) <= 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 text-center">
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Gói cước miễn phí (₫0) — Không cần thanh toán qua Thẻ hay QR
                  </div>
                  <Button
                    type="button"
                    onClick={() =>
                      finalizeSubscriptionActivation({
                        transactionId: `FREE-${Date.now()}`,
                      })
                    }
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang kích hoạt gói miễn phí...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Kích hoạt Gói {selectedPlan.name} ngay (₫0)
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Chọn hình thức thanh toán */
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">
                  Phương thức thanh toán tự động
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("VISA")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === "VISA"
                        ? "border-blue-600 bg-blue-50/80 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 ring-2 ring-blue-600 font-semibold"
                        : "hover:bg-muted/60 border-border"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">
                        Thẻ Visa / Ghi nợ
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cổng 3D-Secure tự động
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("MOMO")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === "MOMO"
                        ? "border-[#A50064] bg-pink-50/80 text-[#A50064] dark:bg-pink-950/50 dark:text-pink-200 ring-2 ring-[#A50064] font-semibold"
                        : "hover:bg-muted/60 border-border"
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-[#A50064] shrink-0" />
                    <div>
                      <div className="text-xs font-bold">
                        MoMo / VietQR (IPN)
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Tự động nhận thông báo QR
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              )}

              {/* PHƯƠNG THỨC 1: THẺ VISA / THẺ GHI NỢ (XÁC THỰC QUA CỔNG 3D-SECURE) */}
              {Number(selectedPlan.price || 0) > 0 && paymentMethod === "VISA" && (
                <div className="rounded-xl border bg-card p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        Cổng thanh toán Thẻ quốc tế & Nội địa
                      </span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Thụ hưởng (POS Admin): {platformCardHolder} ({platformBankName} • {platformCardMasked})
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCardNumber("4221 5678 9012 4829");
                        setCardExpiry("08/29");
                        setCardCvv("889");
                        setCardHolder("CHU CUA HANG POS");
                      }}
                      className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-600"
                    >
                      Điền thẻ mẫu
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Số thẻ *
                      </label>
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 h-4 font-bold text-blue-600 border-blue-500/30"
                      >
                        {detectCardBrand(cardNumber)}
                      </Badge>
                    </div>
                    <div className="relative">
                      <Input
                        placeholder="4221 •••• •••• ••••"
                        value={cardNumber}
                        disabled={actionLoading}
                        onChange={(e) =>
                          setCardNumber(formatCardNumberInput(e.target.value))
                        }
                        className="font-mono tracking-wider pr-10"
                      />
                      <CreditCard className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground block">
                        MM/YY *
                      </label>
                      <Input
                        placeholder="MM/YY"
                        value={cardExpiry}
                        disabled={actionLoading}
                        onChange={(e) =>
                          setCardExpiry(formatExpiryInput(e.target.value))
                        }
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground block">
                        Mã bảo mật (CVV) *
                      </label>
                      <div className="relative">
                        <Input
                          type="password"
                          maxLength={4}
                          placeholder="CVV"
                          value={cardCvv}
                          disabled={actionLoading}
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
                      Tên trên thẻ *
                    </label>
                    <Input
                      placeholder="NGUYEN VAN A"
                      value={cardHolder}
                      disabled={actionLoading}
                      onChange={(e) =>
                        setCardHolder(e.target.value.toUpperCase())
                      }
                      className="uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block">
                      Quốc gia / Khu vực thanh toán
                    </label>
                    <Input
                      value={billingAddress}
                      disabled={actionLoading}
                      onChange={(e) => setBillingAddress(e.target.value)}
                    />
                  </div>

                  {cardStepText && (
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600" />
                      <span>{cardStepText}</span>
                    </div>
                  )}

                  {gatewaySession?.status === "FAILED" && !actionLoading && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 flex items-center gap-2 text-xs text-red-600 font-medium">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>{gatewaySession.providerMessage}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={handleAuthorizeCardSubscription}
                    disabled={actionLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang chờ thông báo chuẩn chi từ Ngân hàng...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Gửi yêu cầu thanh toán qua Cổng Thẻ (₫
                        {Number(selectedPlan.price || 0).toLocaleString(
                          "vi-VN",
                        )}
                        )
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* PHƯƠNG THỨC 2: QUÉT MÃ QR MOMO / VIETQR (NHẬN WEBHOOK TỰ ĐỘNG) */}
              {Number(selectedPlan.price || 0) > 0 && paymentMethod === "MOMO" && (
                <div className="rounded-xl border-2 border-[#A50064]/40 bg-gradient-to-b from-[#A50064]/10 via-background to-background p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#A50064] text-white font-black text-[10px] leading-none flex items-center justify-center">
                        mo
                        <br />
                        mo
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#A50064] dark:text-pink-400">
                          Quét mã QR MoMo / VietQR chuẩn EMVCo
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Tự động kích hoạt gói ngay khi nhận thông báo IPN
                        </div>
                      </div>
                    </div>

                    <div className="flex rounded-lg border bg-muted/50 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setQrMode("VIETQR")}
                        className={`px-2 py-1 rounded-md font-semibold ${
                          qrMode === "VIETQR"
                            ? "bg-[#A50064] text-white"
                            : "text-muted-foreground"
                        }`}
                      >
                        Chuẩn VietQR / MoMo
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrMode("MOBILE_GATEWAY")}
                        className={`px-2 py-1 rounded-md font-semibold ${
                          qrMode === "MOBILE_GATEWAY"
                            ? "bg-[#A50064] text-white"
                            : "text-muted-foreground"
                        }`}
                      >
                        QR Cổng Mobile
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border">
                    <div className="shrink-0 text-center">
                      {creatingSession ? (
                        <div className="w-40 h-40 flex items-center justify-center rounded-lg border">
                          <Loader2 className="w-6 h-6 animate-spin text-[#A50064]" />
                        </div>
                      ) : (
                        <img
                          src={activeQrUrl}
                          alt="MoMo Subscription QR"
                          className="w-40 h-40 object-contain rounded-lg border-2 border-[#A50064]/30 p-1 bg-white"
                        />
                      )}
                      <div className="mt-1 text-[11px] font-semibold text-[#A50064] flex items-center justify-center gap-1">
                        <QrCode className="w-3 h-3" />
                        Quét thanh toán ngay
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-2 text-xs">
                      <div className="p-2 rounded-lg bg-muted/60">
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Đơn vị thụ hưởng
                        </div>
                        <div className="font-bold text-foreground">
                          {platformMomoOwner}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">
                            SĐT MoMo / TK nhận
                          </div>
                          <div className="font-mono font-bold text-[#A50064] dark:text-pink-400">
                            {platformMomoPhone}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleCopy(platformMomoPhone, "phone")}
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
                            Nội dung đối soát tự động
                          </div>
                          <div className="font-mono font-bold text-foreground">
                            {gatewaySession?.referenceCode || "SUB..."}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() =>
                            handleCopy(gatewaySession?.referenceCode || "", "tx")
                          }
                        >
                          {copiedField === "tx" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Trạng thái lắng nghe Webhook từ MoMo */}
                  <div className="rounded-xl border border-[#A50064]/30 bg-[#A50064]/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#A50064] dark:text-pink-300">
                      <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        Đang lắng nghe thông báo nhận tiền (IPN Webhook) từ
                        MoMo...
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {gatewaySession?.sessionId}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#A50064]/15">
                      {gatewaySession?.mobileCheckoutUrl && (
                        <a
                          href={gatewaySession.mobileCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#A50064]/30 bg-background hover:bg-[#A50064]/10 text-[#A50064] dark:text-pink-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Mở trang Cổng MoMo
                        </a>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          simulatingWebhook || !gatewaySession?.sessionId
                        }
                        onClick={handleTriggerMomoWebhook}
                        className="h-7 text-[11px] bg-[#A50064] hover:bg-[#8d0055] text-white ml-auto"
                      >
                        {simulatingWebhook ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3 mr-1" />
                        )}
                        Giả lập Webhook MoMo báo thành công
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckoutOpen(false)}
              disabled={actionLoading}
            >
              Đóng / Hủy giao dịch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upgrade;
