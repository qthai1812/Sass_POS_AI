import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  Smartphone,
  QrCode,
  ShieldCheck,
  Save,
  Building2,
  User,
  Phone,
  Loader2,
} from "lucide-react";

export default function PlatformPaymentSettingsForm({
  paymentConfig,
  onChange,
  onSave,
  saving,
}) {
  const settings = paymentConfig || {};

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value);
  };

  const formatCardNumberDisplay = (val) => {
    const digits = String(val || "").replace(/\D/g, "").slice(0, 16);
    if (!digits) return "•••• •••• •••• ••••";
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const resolveBankBin = (bankName) => {
    const lower = String(bankName || "").toLowerCase();
    if (lower.includes("vietcombank") || lower.includes("vcb")) return "970436";
    if (lower.includes("techcombank") || lower.includes("tcb")) return "970407";
    if (lower.includes("bidv")) return "970418";
    if (lower.includes("vietin") || lower.includes("ctg")) return "970415";
    if (lower.includes("acb")) return "970416";
    if (lower.includes("vpbank") || lower.includes("vpb")) return "970432";
    if (lower.includes("tpbank") || lower.includes("tpb")) return "970423";
    return "970422";
  };

  const cleanMomoPhone = String(settings.momoPhone || "").replace(/\D/g, "");
  const bankBin = resolveBankBin(settings.cardBankName);
  const previewQrUrl =
    settings.momoQrImage?.trim() ||
    (cleanMomoPhone
      ? `https://img.vietqr.io/image/${bankBin}-${cleanMomoPhone}-compact2.png?amount=199000&addInfo=${encodeURIComponent(
          "Nang cap Goi POS Pro"
        )}&accountName=${encodeURIComponent(
          settings.momoOwnerName || "POS ADMIN"
        )}`
      : null);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Cấu hình Nhận tiền Gói cước SaaS (POS Admin — MoMo QR & Thẻ Visa / Ghi nợ)
            </CardTitle>
            <CardDescription className="mt-1">
              Đăng ký thông tin ví MoMo và Thẻ Visa/Ghi nợ nhận tiền của Quản trị
              viên hệ thống (POS Admin). Khi các Chủ cửa hàng đăng ký hoặc nâng
              cấp gói cước (Subscription Plans), tiền sẽ được thanh toán về tài
              khoản này.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Đồng bộ trang Nâng cấp Gói cước (Store Upgrade)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 1. Bật / Tắt cổng thanh toán gói cước */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-pink-500/5 border-pink-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#A50064]/15 text-[#A50064] dark:text-pink-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">
                  Nhận thanh toán qua MoMo / VietQR
                </h4>
                <p className="text-xs text-muted-foreground">
                  Hiển thị mã QR MoMo khi Store mua gói cước
                </p>
              </div>
            </div>
            <Switch
              checked={settings.acceptMomo !== false}
              onCheckedChange={(checked) => onChange("acceptMomo", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">
                  Nhận thanh toán qua Thẻ Visa / Ghi nợ
                </h4>
                <p className="text-xs text-muted-foreground">
                  Cổng thanh toán thẻ quốc tế Visa, Mastercard, Debit
                </p>
              </div>
            </div>
            <Switch
              checked={settings.acceptCard !== false}
              onCheckedChange={(checked) => onChange("acceptCard", checked)}
            />
          </div>
        </div>

        {/* 2. Cấu hình Ví MoMo / VietQR của POS Admin */}
        <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/5 via-background to-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#A50064] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                mo
                <br />
                mo
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Thông tin nhận tiền Ví MoMo / VietQR của POS Admin
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tự động tạo mã QR chuẩn EMVCo kèm giá gói cước khi Chủ cửa
                  hàng chọn thanh toán qua MoMo QR
                </p>
              </div>
            </div>
            <Badge className="bg-[#A50064] hover:bg-[#8d0055] text-white">
              MoMo / VietQR
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            <div className="md:col-span-2 space-y-3.5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#A50064]" />
                  Số điện thoại Ví MoMo nhận tiền *
                </label>
                <Input
                  name="momoPhone"
                  placeholder="VD: 0901234567"
                  value={settings.momoPhone || ""}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-[#A50064]" />
                  Tên chủ tài khoản MoMo (POS Admin) *
                </label>
                <Input
                  name="momoOwnerName"
                  placeholder="VD: NGUYEN VAN ADMIN"
                  value={settings.momoOwnerName || ""}
                  onChange={(e) =>
                    onChange("momoOwnerName", e.target.value.toUpperCase())
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <QrCode className="w-3.5 h-3.5 text-[#A50064]" />
                  Link ảnh QR tùy chỉnh (Tùy chọn — Để trống sẽ tự tạo VietQR chuẩn EMVCo)
                </label>
                <Input
                  name="momoQrImage"
                  placeholder="https://... (để trống hệ thống tự tạo QR theo SĐT & số tiền)"
                  value={settings.momoQrImage || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Khung xem trước QR MoMo */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-xs text-center">
              <div className="text-xs font-bold text-[#A50064] mb-2 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" />
                Xem trước Mã QR POS Admin
              </div>
              {previewQrUrl ? (
                <img
                  src={previewQrUrl}
                  alt="POS Admin MoMo QR Preview"
                  className="w-36 h-36 object-contain rounded-lg border p-1 bg-white"
                />
              ) : (
                <div className="w-36 h-36 rounded-lg border border-dashed flex flex-col items-center justify-center p-3 text-xs text-muted-foreground">
                  <QrCode className="w-8 h-8 mb-1.5 opacity-40" />
                  Nhập SĐT MoMo để tạo mã QR
                </div>
              )}
              <div className="mt-2 text-xs font-semibold text-foreground truncate max-w-[160px]">
                {settings.momoOwnerName || "POS ADMIN"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {settings.momoPhone || "Chưa nhập SĐT"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Cấu hình Thẻ Visa / Thẻ Ghi nợ nhận thanh toán của POS Admin */}
        <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-background to-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs tracking-tighter">
                VISA
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Thông tin Thẻ Visa / Thẻ Ghi nợ thụ hưởng của POS Admin
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tài khoản/thẻ nhận tiền khi các Chủ cửa hàng thanh toán gói
                  cước bằng thẻ Visa, Mastercard hoặc thẻ ghi nợ
                </p>
              </div>
            </div>
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
              Visa / Debit
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-center">
            <div className="md:col-span-3 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Ngân hàng / Tổ chức thẻ *
                  </label>
                  <Input
                    name="cardBankName"
                    placeholder="VD: Vietcombank - Visa"
                    value={settings.cardBankName || ""}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Hiệu lực thẻ (MM/YY)
                  </label>
                  <Input
                    name="cardExpiry"
                    placeholder="VD: 12/29"
                    maxLength={5}
                    value={settings.cardExpiry || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  Số thẻ Visa / Ghi nợ hoặc Số tài khoản nhận *
                </label>
                <Input
                  name="cardNumber"
                  placeholder="VD: 4221 5678 9012 3456"
                  value={settings.cardNumber || ""}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Tên in trên thẻ (Cardholder Name) *
                </label>
                <Input
                  name="cardHolderName"
                  placeholder="VD: POS PRO ENTERPRISE SAAS"
                  value={settings.cardHolderName || ""}
                  onChange={(e) =>
                    onChange("cardHolderName", e.target.value.toUpperCase())
                  }
                />
              </div>
            </div>

            {/* Mô phỏng Thẻ Visa / Debit 3D của POS Admin */}
            <div className="md:col-span-2">
              <div className="relative rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 border border-white/10 overflow-hidden">
                <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-400/15 blur-xl" />
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                    {settings.cardBankName || "POS ADMIN BANK"}
                  </span>
                  <span className="text-sm font-black italic tracking-wider text-white">
                    VISA
                  </span>
                </div>

                <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 to-yellow-500 mb-4 opacity-90" />

                <div className="font-mono text-base sm:text-lg tracking-widest font-semibold mb-4">
                  {formatCardNumberDisplay(settings.cardNumber)}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[9px] uppercase text-blue-200/70">
                      Chủ thẻ thụ hưởng (POS Admin)
                    </div>
                    <div className="font-semibold tracking-wide truncate max-w-[150px]">
                      {settings.cardHolderName || "POS PRO ADMIN"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase text-blue-200/70">
                      Hiệu lực
                    </div>
                    <div className="font-mono font-semibold">
                      {settings.cardExpiry || "MM/YY"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu cấu hình nhận tiền POS Admin
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
