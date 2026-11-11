import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  detectCardBrand,
  formatCardNumberInput,
  formatExpiryInput,
  formatVnd,
  sanitizeCvvInput,
} from "@/utils/paymentGatewayUtils";

const CardFieldsBody = ({
  cardNumber,
  onCardNumberChange,
  cardExpiry,
  onCardExpiryChange,
  cardCvv,
  onCardCvvChange,
  cardHolder,
  onCardHolderChange,
  showBillingAddress = false,
  billingAddress = "",
  onBillingAddressChange,
  processing = false,
  cvvPlaceholder = "CVV",
  cardStepText = "",
  gatewaySession = null,
  amount = 0,
  submitDisabled = false,
  submitLabelPrefix = "Gửi yêu cầu thanh toán qua Cổng Thẻ",
  onSubmit,
  securityNote,
}) => {
  const detectedBrand = detectCardBrand(cardNumber);

  return (
    <>
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
              onCardNumberChange(formatCardNumberInput(e.target.value))
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
              onCardExpiryChange(formatExpiryInput(e.target.value))
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
              placeholder={cvvPlaceholder}
              value={cardCvv}
              disabled={processing}
              onChange={(e) =>
                onCardCvvChange(sanitizeCvvInput(e.target.value))
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
          onChange={(e) => onCardHolderChange(e.target.value.toUpperCase())}
          className="uppercase tracking-wide"
        />
      </div>

      {showBillingAddress && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">
            Quốc gia / Khu vực thanh toán
          </label>
          <Input
            value={billingAddress}
            disabled={processing}
            onChange={(e) => onBillingAddressChange?.(e.target.value)}
          />
        </div>
      )}

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
        onClick={onSubmit}
        disabled={submitDisabled}
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
            {submitLabelPrefix} ({formatVnd(amount)})
          </>
        )}
      </Button>

      {securityNote && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{securityNote}</span>
        </div>
      )}
    </>
  );
};

const CardGatewayPanel = ({
  variant = "pos",
  title,
  subtitle,
  onFillSampleCard,
  ...fieldProps
}) => {
  if (variant === "plain") {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              {title}
            </span>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFillSampleCard}
            className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-600"
          >
            Điền thẻ mẫu
          </Button>
        </div>

        <CardFieldsBody {...fieldProps} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-500/5 via-background to-background p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-600 text-white">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{title}</div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFillSampleCard}
            className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
          >
            Điền thẻ mẫu
          </Button>
        </div>
      </div>

      <div className="space-y-3 bg-card p-3.5 rounded-xl border shadow-2xs">
        <CardFieldsBody {...fieldProps} />
      </div>
    </div>
  );
};

export default CardGatewayPanel;
