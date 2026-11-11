import React from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import CurrentSubscriptionBanner from "./components/CurrentSubscriptionBanner";
import PlanCard from "./components/PlanCard";
import SubscriptionCheckoutDialog from "./components/SubscriptionCheckoutDialog";
import { useSubscriptionUpgradeFlow } from "./hooks/useSubscriptionUpgradeFlow";

const Upgrade = () => {
  const {
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
    isCurrentPlan,
    selectedPlan,
    checkoutOpen,
    setCheckoutOpen,
    paymentMethod,
    setPaymentMethod,
    platformDisplay,
    cardForm,
    gatewaySession,
    creatingSession,
    qrMode,
    setQrMode,
    activeQrUrl,
    simulatingWebhook,
    cardStepText,
    handleFillSampleCard,
    handleOpenCheckout,
    handleCancelCurrentSubscription,
    handleAuthorizeCardSubscription,
    handleTriggerMomoWebhook,
    handleActivateFreePlan,
  } = useSubscriptionUpgradeFlow();

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
          <CurrentSubscriptionBanner
            subscription={currentSubscription}
            canManageBilling={canManageBilling}
            actionLoading={actionLoading}
            onCancel={handleCancelCurrentSubscription}
          />

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
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                activePlan={isCurrentPlan(plan)}
                hasCurrentSubscription={Boolean(currentSubscription)}
                actionLoading={actionLoading}
                onSelectPlan={handleOpenCheckout}
              />
            ))}
          </div>
        </>
      )}

      <SubscriptionCheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        selectedPlan={selectedPlan}
        paymentMethod={paymentMethod}
        onSelectPaymentMethod={setPaymentMethod}
        platformDisplay={platformDisplay}
        cardForm={cardForm}
        cardStepText={cardStepText}
        gatewaySession={gatewaySession}
        creatingSession={creatingSession}
        qrMode={qrMode}
        onQrModeChange={setQrMode}
        activeQrUrl={activeQrUrl}
        simulatingWebhook={simulatingWebhook}
        actionLoading={actionLoading}
        onFillSampleCard={handleFillSampleCard}
        onActivateFreePlan={handleActivateFreePlan}
        onAuthorizeCard={handleAuthorizeCardSubscription}
        onTriggerMomoWebhook={handleTriggerMomoWebhook}
      />
    </div>
  );
};

export default Upgrade;
