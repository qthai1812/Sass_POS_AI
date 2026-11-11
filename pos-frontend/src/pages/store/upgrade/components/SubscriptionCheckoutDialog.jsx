import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  CreditCard,
  Loader2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { formatVnd } from "@/utils/paymentGatewayUtils";
import { useClipboardCopy } from "@/hooks/useClipboardCopy";
import CardGatewayPanel from "@/components/payment/CardGatewayPanel";
import MomoQrPaymentPanel from "@/components/payment/MomoQrPaymentPanel";

const SubscriptionCheckoutDialog = ({
  open,
  onOpenChange,
  selectedPlan,
  paymentMethod,
  onSelectPaymentMethod,
  platformDisplay,
  cardForm,
  cardStepText,
  gatewaySession,
  creatingSession,
  qrMode,
  onQrModeChange,
  activeQrUrl,
  simulatingWebhook,
  actionLoading,
  onFillSampleCard,
  onActivateFreePlan,
  onAuthorizeCard,
  onTriggerMomoWebhook,
}) => {
  const { copiedField, handleCopy } = useClipboardCopy();
  const isPaidPlan = Number(selectedPlan?.price || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {selectedPlan.maxBranches > 0
                    ? selectedPlan.maxBranches
                    : "Không giới hạn"}{" "}
                  chi nhánh •{" "}
                  {selectedPlan.maxUsers > 0
                    ? selectedPlan.maxUsers
                    : "Không giới hạn"}{" "}
                  nhân viên •{" "}
                  {selectedPlan.maxProducts > 0
                    ? selectedPlan.maxProducts
                    : "Không giới hạn"}{" "}
                  sản phẩm
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                  {formatVnd(selectedPlan.price)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  /{selectedPlan.billingCycle?.toLowerCase()}
                </div>
              </div>
            </div>

            {!isPaidPlan ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 text-center">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Gói cước miễn phí (₫0) — Không cần thanh toán qua Thẻ hay QR
                </div>
                <Button
                  type="button"
                  onClick={onActivateFreePlan}
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
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block">
                  Phương thức thanh toán tự động
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectPaymentMethod("VISA")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      paymentMethod === "VISA"
                        ? "border-blue-600 bg-blue-50/80 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 ring-2 ring-blue-600 font-semibold"
                        : "hover:bg-muted/60 border-border"
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Thẻ Visa / Ghi nợ</div>
                      <div className="text-[10px] text-muted-foreground">
                        Cổng 3D-Secure tự động
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectPaymentMethod("MOMO")}
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

            {isPaidPlan && paymentMethod === "VISA" && (
              <CardGatewayPanel
                variant="plain"
                title="Cổng thanh toán Thẻ quốc tế & Nội địa"
                subtitle={`Thụ hưởng (POS Admin): ${platformDisplay.platformCardHolder} (${platformDisplay.platformBankName} • ${platformDisplay.platformCardMasked})`}
                onFillSampleCard={onFillSampleCard}
                cardNumber={cardForm.cardNumber}
                onCardNumberChange={cardForm.setCardNumber}
                cardExpiry={cardForm.cardExpiry}
                onCardExpiryChange={cardForm.setCardExpiry}
                cardCvv={cardForm.cardCvv}
                onCardCvvChange={cardForm.setCardCvv}
                cardHolder={cardForm.cardHolder}
                onCardHolderChange={cardForm.setCardHolder}
                showBillingAddress
                billingAddress={cardForm.billingAddress}
                onBillingAddressChange={cardForm.setBillingAddress}
                cvvPlaceholder="CVV"
                processing={actionLoading}
                cardStepText={cardStepText}
                gatewaySession={gatewaySession}
                amount={selectedPlan.price}
                submitDisabled={actionLoading}
                submitLabelPrefix="Gửi yêu cầu thanh toán qua Cổng Thẻ"
                onSubmit={onAuthorizeCard}
              />
            )}

            {isPaidPlan && paymentMethod === "MOMO" && (
              <MomoQrPaymentPanel
                title="Quét mã QR MoMo / VietQR chuẩn EMVCo"
                subtitle="Tự động kích hoạt gói ngay khi nhận thông báo IPN"
                qrMode={qrMode}
                onQrModeChange={onQrModeChange}
                creatingSession={creatingSession}
                qrImageUrl={activeQrUrl}
                qrImageAlt="MoMo Subscription QR"
                qrSizeClass="w-40 h-40"
                qrCaption="Quét thanh toán ngay"
                ownerLabel="Đơn vị thụ hưởng"
                ownerName={platformDisplay.platformMomoOwner}
                phoneLabel="SĐT MoMo / TK nhận"
                phone={platformDisplay.platformMomoPhone}
                copiedField={copiedField}
                onCopy={handleCopy}
                showAmountInReference={false}
                referenceLabel="Nội dung đối soát tự động"
                referenceCode={gatewaySession?.referenceCode}
                referenceFallback="SUB..."
                referenceCopyKey="tx"
                gatewaySession={gatewaySession}
                waitingHeadline="Đang lắng nghe thông báo nhận tiền (IPN Webhook) từ MoMo..."
                openPortalLabel="Mở trang Cổng MoMo"
                simulateButtonLabel="Giả lập Webhook MoMo báo thành công"
                simulatingWebhook={simulatingWebhook}
                simulateDisabled={
                  simulatingWebhook || !gatewaySession?.sessionId
                }
                onTriggerWebhook={onTriggerMomoWebhook}
                showStatusDetails={false}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={actionLoading}
          >
            Đóng / Hủy giao dịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionCheckoutDialog;
