import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  Radio,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import { formatVnd } from "@/utils/paymentGatewayUtils";

const MomoQrPaymentPanel = ({
  title = "Quét Mã QR MoMo / Chuẩn EMVCo VietQR",
  subtitle = "Tự động hoàn tất ngay khi nhận thông báo IPN từ bên thứ 3",
  qrMode,
  onQrModeChange,
  creatingSession,
  qrImageUrl,
  qrImageAlt = "MoMo VietQR Payment",
  qrSizeClass = "w-44 h-44",
  qrCaption,
  ownerLabel = "Chủ tài khoản / Ví thụ hưởng",
  ownerName,
  bankBadge = null,
  phoneLabel = "SĐT Ví MoMo / Số TK nhận",
  phone,
  copiedField,
  onCopy,
  showAmountInReference = false,
  amount = 0,
  referenceLabel = "Số tiền & Mã đối soát tự động",
  referenceCode,
  referenceFallback = "POS...",
  referenceCopyKey = "ref",
  gatewaySession = null,
  successHeadline = "Đã nhận thông báo thanh toán thành công từ MoMo!",
  waitingHeadline = "Đang chờ thông báo nhận tiền (IPN Webhook) từ MoMo...",
  waitingDescription = null,
  openPortalLabel = "Mở trang Cổng MoMo",
  simulateButtonLabel = "Giả lập Webhook MoMo báo nhận tiền thành công",
  simulatingWebhook = false,
  simulateDisabled = false,
  onTriggerWebhook,
  onRetrySession,
  showStatusDetails = true,
}) => {
  const defaultQrCaption =
    qrMode === "VIETQR"
      ? "Quét bằng App Ngân hàng / MoMo"
      : "Quét bằng Camera ĐT / Zalo";

  return (
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
              {title}
            </div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>

        {/* Chuyển đổi chuẩn QR để tương thích mọi trình quét */}
        <div className="flex rounded-lg border bg-muted/50 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onQrModeChange("VIETQR")}
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
            onClick={() => onQrModeChange("MOBILE_GATEWAY")}
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
            <div
              className={`${qrSizeClass} flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#A50064]/30 bg-muted/20`}
            >
              <Loader2 className="w-7 h-7 animate-spin text-[#A50064]" />
              <span className="text-[11px] text-muted-foreground mt-2">
                Đang tạo mã QR...
              </span>
            </div>
          ) : (
            <img
              src={qrImageUrl}
              alt={qrImageAlt}
              className={`${qrSizeClass} object-contain rounded-lg border-2 border-[#A50064]/30 p-1 bg-white`}
            />
          )}
          <div className="mt-1.5 text-center text-[11px] font-semibold text-[#A50064] flex items-center justify-center gap-1">
            <QrCode className="w-3 h-3" />
            {qrCaption || defaultQrCaption}
          </div>
        </div>

        <div className="flex-1 w-full space-y-2 text-xs">
          <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">
                {ownerLabel}
              </div>
              <div className="font-bold text-foreground">{ownerName}</div>
            </div>
            {bankBadge && (
              <Badge variant="outline" className="text-[10px]">
                {bankBadge}
              </Badge>
            )}
          </div>

          <div className="p-2 rounded-lg bg-muted/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">
                {phoneLabel}
              </div>
              <div className="font-mono font-bold text-sm text-[#A50064] dark:text-pink-400">
                {phone}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(phone, "phone")}
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
                {referenceLabel}
              </div>
              {showAmountInReference ? (
                <div className="font-bold text-emerald-600">
                  {formatVnd(amount)} •{" "}
                  <span className="font-mono text-foreground">
                    {referenceCode || referenceFallback}
                  </span>
                </div>
              ) : (
                <div className="font-mono font-bold text-foreground">
                  {referenceCode || referenceFallback}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onCopy(referenceCode || "", referenceCopyKey)}
            >
              {copiedField === referenceCopyKey ? (
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
        {showStatusDetails && gatewaySession?.status === "SUCCESS" ? (
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div>{successHeadline}</div>
              <div className="text-[11px] font-normal opacity-90">
                {gatewaySession.providerMessage} — Đang tự động hoàn tất...
              </div>
            </div>
          </div>
        ) : showStatusDetails && gatewaySession?.status === "FAILED" ? (
          <div className="flex items-center justify-between gap-2 text-red-600 text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>
                {gatewaySession.providerMessage ||
                  "Giao dịch bị hủy hoặc thất bại."}
              </span>
            </div>
            {onRetrySession && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetrySession}
                className="h-7 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tạo mã QR mới
              </Button>
            )}
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
                <span>{waitingHeadline}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {gatewaySession?.sessionId || "Đang khởi tạo..."}
              </span>
            </div>

            {waitingDescription && (
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                {waitingDescription}
              </div>
            )}

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
                  {openPortalLabel}
                </a>
              )}
              <Button
                type="button"
                size="sm"
                disabled={simulateDisabled}
                onClick={() => import.meta.env.DEV && onTriggerWebhook?.()}
                style={{ display: import.meta.env.DEV ? undefined : "none" }}
                className="h-7 text-[11px] bg-[#A50064] hover:bg-[#8d0055] text-white ml-auto"
              >
                {simulatingWebhook ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3 mr-1" />
                )}
                {simulateButtonLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MomoQrPaymentPanel;
