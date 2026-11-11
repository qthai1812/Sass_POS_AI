import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Loader2 } from "lucide-react";
import { formatVnd } from "@/utils/paymentGatewayUtils";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import MomoQrPaymentPanel from "@/components/payment/MomoQrPaymentPanel";
import CardGatewayPanel from "@/components/payment/CardGatewayPanel";
import ShiftWarningBanner from "./components/ShiftWarningBanner";
import PaymentAmountSummary from "./components/PaymentAmountSummary";
import LoyaltyPointsBanner from "./components/LoyaltyPointsBanner";
import PaymentMethodSelector from "./components/PaymentMethodSelector";
import CashPaymentSection from "./components/CashPaymentSection";
import { usePosPaymentFlow } from "./hooks/usePosPaymentFlow";

const PaymentDialog = ({
  showPaymentDialog,
  setShowPaymentDialog,
  setShowReceiptDialog,
}) => {
  const { copiedField, handleCopy } = useClipboardCopy();
  const {
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
    gatewaySession,
    creatingSession,
    qrMode,
    setQrMode,
    activeQrImageUrl,
    simulatingWebhook,
    cardStepText,
    cardNumber,
    setCardNumber,
    cardExpiry,
    setCardExpiry,
    cardCvv,
    setCardCvv,
    cardHolder,
    setCardHolder,
    initGatewaySession,
    finalizeOrderCreation,
    handleClosePaymentDialog,
    handleSelectPaymentMethod,
    handleQuickStartShift,
    handleFillSampleCard,
    handleAuthorizeCardGateway,
    handleTriggerMomoWebhook,
  } = usePosPaymentFlow({
    showPaymentDialog,
    setShowPaymentDialog,
    setShowReceiptDialog,
  });

  return (
    <Dialog open={showPaymentDialog} onOpenChange={handleClosePaymentDialog}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center justify-between pr-4">
            <span className="flex items-center gap-2">
              Thanh toán Đơn hàng
              {pendingOrder?.id && (
                <Badge
                  variant="secondary"
                  className="text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                >
                  Đơn chờ #{pendingOrder.id} (PENDING)
                </Badge>
              )}
            </span>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            >
              {formatVnd(total)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {needsShift && (
            <ShiftWarningBanner
              startingShift={startingShift}
              onQuickStartShift={handleQuickStartShift}
            />
          )}

          <PaymentAmountSummary
            itemCount={cart.length}
            subTotal={subTotal}
            taxAmount={taxAmount}
            taxRate={taxRate}
            discountAmount={discountAmount}
            isRedeemingPoints={loyaltySummary.isRedeemingPoints}
            pointsUsed={loyaltySummary.pointsUsed}
            couponCode={couponCode}
            total={total}
          />

          <LoyaltyPointsBanner
            customer={selectedCustomer}
            availablePoints={loyaltySummary.availablePoints}
            pointsUsed={loyaltySummary.pointsUsed}
            earnedPoints={loyaltySummary.earnedPoints}
            projectedPoints={loyaltySummary.projectedPoints}
          />

          <PaymentMethodSelector
            methods={enabledMethods}
            selectedMethod={normalizedSelected}
            onSelectMethod={handleSelectPaymentMethod}
          />

          {normalizedSelected === "CASH" && (
            <CashPaymentSection
              total={total}
              cashReceived={cashReceived}
              onCashReceivedChange={setCashReceived}
              numericCashReceived={cashMetrics.numericCashReceived}
              changeAmount={cashMetrics.changeAmount}
            />
          )}

          {normalizedSelected === "UPI" && (
            <MomoQrPaymentPanel
              title="Quét Mã QR MoMo / Chuẩn EMVCo VietQR"
              subtitle="Tự động hoàn tất đơn ngay khi nhận thông báo IPN từ bên thứ 3"
              qrMode={qrMode}
              onQrModeChange={setQrMode}
              creatingSession={creatingSession}
              qrImageUrl={activeQrImageUrl}
              qrImageAlt="MoMo VietQR Payment"
              qrSizeClass="w-44 h-44"
              ownerLabel="Chủ tài khoản / Ví thụ hưởng"
              ownerName={merchantInfo.momoOwnerName}
              bankBadge={gatewaySession?.bankName || merchantInfo.storeCardBank}
              phoneLabel="SĐT Ví MoMo / Số TK nhận"
              phone={merchantInfo.momoPhone}
              copiedField={copiedField}
              onCopy={handleCopy}
              showAmountInReference
              amount={total}
              referenceLabel="Số tiền & Mã đối soát tự động"
              referenceCode={gatewaySession?.referenceCode}
              referenceFallback="POS..."
              referenceCopyKey="ref"
              gatewaySession={gatewaySession}
              waitingHeadline="Đang chờ thông báo nhận tiền (IPN Webhook) từ MoMo..."
              waitingDescription={
                <>
                  Hệ thống sẽ <strong>tự động tạo đơn & in hóa đơn</strong> ngay
                  khi nhận được callback báo có tiền từ cổng MoMo / Napas247
                  (không cần thu ngân bấm xác nhận tiền mặt).
                </>
              }
              openPortalLabel="Mở trang Cổng MoMo (Test trên trình duyệt)"
              simulateButtonLabel="Giả lập Webhook MoMo báo nhận tiền thành công"
              simulatingWebhook={simulatingWebhook}
              simulateDisabled={
                simulatingWebhook || !gatewaySession?.sessionId || needsShift
              }
              onTriggerWebhook={() => handleTriggerMomoWebhook("SUCCESS")}
              onRetrySession={() => initGatewaySession("UPI")}
            />
          )}

          {normalizedSelected === "CARD" && (
            <CardGatewayPanel
              variant="pos"
              title="Cổng thanh toán Thẻ Visa / Thẻ ghi nợ (3D-Secure)"
              subtitle={`Thụ hưởng: ${merchantInfo.storeCardHolder} (${merchantInfo.storeCardBank} • ${merchantInfo.storeCardMasked})`}
              onFillSampleCard={handleFillSampleCard}
              cardNumber={cardNumber}
              onCardNumberChange={setCardNumber}
              cardExpiry={cardExpiry}
              onCardExpiryChange={setCardExpiry}
              cardCvv={cardCvv}
              onCardCvvChange={setCardCvv}
              cardHolder={cardHolder}
              onCardHolderChange={setCardHolder}
              cvvPlaceholder="3-4 số (000 = test lỗi)"
              processing={processing}
              cardStepText={cardStepText}
              gatewaySession={gatewaySession}
              amount={total}
              submitDisabled={processing || cart.length === 0 || needsShift}
              submitLabelPrefix="Gửi yêu cầu trừ tiền qua Cổng Thẻ"
              onSubmit={handleAuthorizeCardGateway}
              securityNote="Đơn hàng sẽ tự động hoàn tất ngay khi Cổng Visa / Mastercard phản hồi chuẩn chi thành công."
            />
          )}
        </div>

        {/* FOOTER: Chỉ hiển thị nút xác nhận thu tiền trực tiếp khi chọn TIỀN MẶT (CASH) */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClosePaymentDialog(false)}
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
                  Đã nhận tiền mặt {formatVnd(total)}
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
