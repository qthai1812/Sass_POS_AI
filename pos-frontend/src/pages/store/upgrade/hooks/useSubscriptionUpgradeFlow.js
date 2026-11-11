import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/components/ui/use-toast";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import { useMomoWebhookPolling } from "@/hooks/useMomoWebhookPolling";
import { useGatewayPaymentControls } from "@/hooks/useGatewayPaymentControls";
import api from "@/utils/api";
import {
  mergeGatewaySession,
  resolveActiveQrImageUrl,
} from "@/utils/paymentGatewayUtils";
import { getAllSubscriptionPlans } from "../../../../Redux Toolkit/features/subscriptionPlan/subscriptionPlanThunks";
import {
  subscribeToPlan,
  upgradeSubscription,
  getStoreSubscriptions,
  cancelSubscription,
} from "../../../../Redux Toolkit/features/subscription/subscriptionThunks";
import {
  filterVisiblePlans,
  findCurrentSubscription,
  getSwitchBlocker,
  isPlanCurrent,
  normalizeSubscriptionGateway,
  resolvePlatformPaymentDisplay,
} from "../upgradeUtils";

export function useSubscriptionUpgradeFlow() {
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
  const { userProfile } = useSelector((state) => state.user);

  const { entitlements, refresh: refreshEntitlements } = usePlanEntitlements();
  const canManageBilling =
    userProfile?.role === "ROLE_STORE_OWNER" ||
    userProfile?.role === "ROLE_SUPER_ADMIN";

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("VISA");
  const [billingAddress, setBillingAddress] = useState("Việt Nam");
  const [platformConfig, setPlatformConfig] = useState(null);
  const subCompletedRef = useRef(false);

  const gw = useGatewayPaymentControls();
  const {
    gatewaySession,
    setGatewaySession,
    setCreatingSession,
    qrMode,
    resetCardFields,
    resetGatewayDisplay,
    fillSampleCard,
    triggerMomoWebhook,
    authorizeCardWithGateway,
  } = gw;

  const currentSubscription = useMemo(
    () => findCurrentSubscription(subscriptions, store?.id),
    [subscriptions, store?.id],
  );

  const visiblePlans = useMemo(
    () => filterVisiblePlans(plans, currentSubscription),
    [plans, currentSubscription],
  );

  useEffect(() => {
    dispatch(getAllSubscriptionPlans());
    if (store?.id) {
      dispatch(getStoreSubscriptions({ storeId: store.id }));
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

  const platformDisplay = useMemo(
    () => resolvePlatformPaymentDisplay(platformConfig),
    [platformConfig],
  );

  const finalizeSubscriptionActivation = useCallback(
    async (verifiedSession) => {
      if (subCompletedRef.current || !store?.id || !selectedPlan) return;
      subCompletedRef.current = true;
      setActionLoading(true);
      setActionError(null);

      const transactionId =
        verifiedSession?.transactionId ||
        `${paymentMethod}-${Date.now().toString().slice(-6)}`;
      const normalizedGateway = normalizeSubscriptionGateway(paymentMethod);

      try {
        if (currentSubscription) {
          await dispatch(
            upgradeSubscription({
              storeId: store.id,
              planId: selectedPlan.id,
              gateway: normalizedGateway,
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
              gateway: normalizedGateway,
              transactionId,
            }),
          ).unwrap();
          setSuccessMsg(
            `Đã nhận thông báo thanh toán! Đăng ký thành công gói "${selectedPlan.name}" (Mã GD: ${transactionId}).`,
          );
        }
        dispatch(getStoreSubscriptions({ storeId: store.id }));
        refreshEntitlements();
        setCheckoutOpen(false);
        resetCardFields();
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
      resetCardFields,
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
          recipientPhone: platformDisplay.platformMomoPhone,
          recipientName: platformDisplay.platformMomoOwner,
          bankName: platformDisplay.platformBankName,
          bankAccount: platformDisplay.safeBankAccount,
        });
        setGatewaySession((prev) => mergeGatewaySession(prev, res.data));
      } catch (e) {
        console.error("Failed to create subscription payment session:", e);
      } finally {
        setCreatingSession(false);
      }
    },
    [
      checkoutOpen,
      selectedPlan,
      platformDisplay,
      setCreatingSession,
      setGatewaySession,
    ],
  );

  useEffect(() => {
    if (checkoutOpen && selectedPlan) {
      initSubscriptionGatewaySession(paymentMethod);
    } else {
      resetGatewayDisplay();
    }
  }, [
    checkoutOpen,
    selectedPlan,
    paymentMethod,
    initSubscriptionGatewaySession,
    resetGatewayDisplay,
  ]);

  const handleMomoPollSuccess = useCallback(
    (updated) => {
      if (!subCompletedRef.current) {
        finalizeSubscriptionActivation(updated);
      }
    },
    [finalizeSubscriptionActivation],
  );

  useMomoWebhookPolling({
    enabled: checkoutOpen && paymentMethod === "MOMO",
    gatewaySession,
    onSessionChange: setGatewaySession,
    onSuccess: handleMomoPollSuccess,
  });

  const handleTriggerMomoWebhook = () =>
    triggerMomoWebhook({
      providerName: "MoMo SaaS Billing IPN",
      status: "SUCCESS",
      onSuccess: async (data) => {
        if (!subCompletedRef.current) {
          await finalizeSubscriptionActivation(data);
        }
      },
      onError: () => {
        toast({
          title: "Lỗi kết nối Webhook",
          description: "Không thể gửi tín hiệu Webhook.",
          variant: "destructive",
        });
      },
    });

  const handleAuthorizeCardSubscription = () =>
    authorizeCardWithGateway({
      ensureSessionId: async () => {
        if (gatewaySession?.sessionId) {
          return gatewaySession.sessionId;
        }
        try {
          const res = await api.post("/api/payment-gateway/sessions", {
            storeId: null,
            planId: selectedPlan?.id || null,
            storeName: `POS Pro SaaS (${selectedPlan?.name})`,
            amount: Math.max(1000, Math.round(selectedPlan?.price || 100000)),
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
        "Đang xác thực 3D-Secure & chờ thông báo chuẩn chi từ ngân hàng phát hành...",
      formatSuccessStepText: (s) =>
        `Ngân hàng xác nhận thành công (${s.transactionId}). Đang kích hoạt gói cước...`,
      onBusyChange: setActionLoading,
      onSuccess: (updated) => finalizeSubscriptionActivation(updated),
      onDeclined: (providerMessage) => {
        toast({
          title: "Cổng thanh toán Thẻ từ chối giao dịch",
          description:
            providerMessage ||
            "Thông tin thẻ không hợp lệ hoặc bị ngân hàng từ chối.",
          variant: "destructive",
        });
      },
    });

  const handleOpenCheckout = async (plan) => {
    if (plan.active === false) {
      const msg = `Gói cước "${plan.name}" hiện đã ngừng cung cấp.`;
      setActionError(msg);
      toast({
        title: "Gói cước không khả dụng",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    if (!canManageBilling) {
      const msg =
        "Chỉ Chủ cửa hàng (ROLE_STORE_OWNER) mới có quyền đăng ký hoặc nâng cấp gói cước.";
      setActionError(msg);
      toast({
        title: "Không đủ quyền thanh toán",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    const blocker = getSwitchBlocker(plan, entitlements);
    if (blocker) {
      setActionError(blocker);
      setSuccessMsg(null);
      toast({
        title: "Không thể chuyển sang gói này",
        description: blocker,
        variant: "destructive",
      });
      return;
    }
    setSelectedPlan(plan);
    setActionError(null);
    setSuccessMsg(null);

    if (Number(plan.price || 0) <= 0) {
      subCompletedRef.current = false;
      setActionLoading(true);
      const freeTxId = `FREE-${Date.now()}`;
      try {
        if (currentSubscription) {
          await dispatch(
            upgradeSubscription({
              storeId: store.id,
              planId: plan.id,
              gateway: "RAZORPAY",
              transactionId: freeTxId,
            }),
          ).unwrap();
        } else {
          await dispatch(
            subscribeToPlan({
              storeId: store.id,
              planId: plan.id,
              gateway: "RAZORPAY",
              transactionId: freeTxId,
            }),
          ).unwrap();
        }
        dispatch(getStoreSubscriptions({ storeId: store.id }));
        refreshEntitlements();
        setSuccessMsg(`Đã kích hoạt thành công gói "${plan.name}".`);
        toast({
          title: "Kích hoạt gói thành công!",
          description: `Gói "${plan.name}" đã được áp dụng cho cửa hàng.`,
        });
      } catch (err) {
        const errMsg =
          (err && err.message) || err || "Không thể kích hoạt gói miễn phí.";
        setActionError(errMsg);
        toast({
          title: "Lỗi kích hoạt gói",
          description: errMsg,
          variant: "destructive",
        });
      } finally {
        setActionLoading(false);
      }
      return;
    }

    setCheckoutOpen(true);
  };

  const handleCancelCurrentSubscription = async () => {
    if (!currentSubscription?.id) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn hủy gói "${
          currentSubscription.planName || currentSubscription.plan?.name
        }" hiện tại? Cửa hàng sẽ chuyển về giới hạn mặc định (Free Starter).`,
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(cancelSubscription(currentSubscription.id)).unwrap();
      if (store?.id) {
        dispatch(getStoreSubscriptions({ storeId: store.id }));
      }
      refreshEntitlements();
      toast({
        title: "Đã hủy gói cước",
        description: "Gói đăng ký của cửa hàng đã được hủy thành công.",
      });
    } catch (err) {
      toast({
        title: "Lỗi khi hủy gói",
        description:
          typeof err === "string" ? err : "Không thể hủy gói cước",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const activeQrUrl = resolveActiveQrImageUrl({
    customQrImage: platformConfig?.momoQrImage,
    qrMode,
    gatewaySession,
    phone: platformDisplay.platformMomoPhone,
    amount: Math.max(1000, Math.round(selectedPlan?.price || 0)),
    defaultAddInfo: "POS PRO SUB",
    accountName: platformDisplay.platformMomoOwner,
  });

  return {
    plansLoading,
    plansError,
    subLoading,
    subError,
    canManageBilling,
    actionLoading,
    actionError,
    successMsg,
    currentSubscription,
    visiblePlans,
    isCurrentPlan: (plan) => isPlanCurrent(currentSubscription, plan),
    selectedPlan,
    checkoutOpen,
    setCheckoutOpen,
    paymentMethod,
    setPaymentMethod,
    platformDisplay,
    cardForm: {
      cardNumber: gw.cardNumber,
      setCardNumber: gw.setCardNumber,
      cardExpiry: gw.cardExpiry,
      setCardExpiry: gw.setCardExpiry,
      cardCvv: gw.cardCvv,
      setCardCvv: gw.setCardCvv,
      cardHolder: gw.cardHolder,
      setCardHolder: gw.setCardHolder,
      billingAddress,
      setBillingAddress,
    },
    gatewaySession,
    creatingSession: gw.creatingSession,
    qrMode,
    setQrMode: gw.setQrMode,
    activeQrUrl,
    simulatingWebhook: gw.simulatingWebhook,
    cardStepText: gw.cardStepText,
    handleFillSampleCard: () => fillSampleCard("CHU CUA HANG POS"),
    handleOpenCheckout,
    handleCancelCurrentSubscription,
    handleAuthorizeCardSubscription,
    handleTriggerMomoWebhook,
    handleActivateFreePlan: () =>
      finalizeSubscriptionActivation({
        transactionId: `FREE-${Date.now()}`,
      }),
  };
}
