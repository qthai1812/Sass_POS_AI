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
import {
  CreditCard,
  Smartphone,
  Banknote,
  QrCode,
  ShieldCheck,
  Save,
  Building2,
  User,
  Phone,
} from "lucide-react";
import ToggleSwitch from "./ToggleSwitch";

const PaymentSettings = ({ settings, onChange, onSave }) => {
  const handleToggleChange = (e) => {
    const { name, checked } = e.target;
    onChange(name, checked);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onChange(name, value);
  };

  const formatCardNumberDisplay = (val) => {
    const digits = String(val || "").replace(/\D/g, "").slice(0, 16);
    if (!digits) return "•••• •••• •••• ••••";
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  // Tạo link QR chuẩn EMVCo VietQR / MoMo xem trước từ số điện thoại đã đăng ký (quét hợp lệ trên mọi app)
  const cleanMomoPhone = String(settings.momoPhone || "").replace(/\D/g, "");
  const resolveBankBin = (bankName) => {
    const lower = String(bankName || "").toLowerCase();
    if (lower.includes("vietcombank") || lower.includes("vcb")) return "970436";
    if (lower.includes("techcombank") || lower.includes("tcb")) return "970407";
    if (lower.includes("bidv")) return "970418";
    if (lower.includes("vietin") || lower.includes("ctg")) return "970415";
    if (lower.includes("acb")) return "970416";
    if (lower.includes("vpbank") || lower.includes("vpb")) return "970432";
    if (lower.includes("tpbank") || lower.includes("tpb")) return "970423";
    return "970422"; // MB Bank / Napas247 chuẩn VietQR theo SĐT
  };
  const bankBin = resolveBankBin(settings.cardBankName);
  const previewQrUrl =
    settings.momoQrImage?.trim() ||
    (cleanMomoPhone
      ? `https://img.vietqr.io/image/${bankBin}-${cleanMomoPhone}-compact2.png?amount=50000&addInfo=${encodeURIComponent(
          "Thanh toan POS"
        )}&accountName=${encodeURIComponent(
          settings.momoOwnerName || "POS STORE"
        )}`
      : null);

  return (
    <Card id="payment-settings" className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Cấu hình Nhận Thanh toán (MoMo QR & Thẻ Visa / Ghi nợ)
            </CardTitle>
            <CardDescription className="mt-1">
              Đăng ký thông tin ví MoMo và Thẻ Visa/Ghi nợ nhận tiền của cửa
              hàng. Khi thu ngân bấm thanh toán tại quầy POS, mã QR và cổng
              thanh toán thẻ sẽ hiển thị theo thông tin này.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Đồng bộ toàn bộ chi nhánh POS
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 1. Bật / Tắt phương thức thanh toán */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Tiền mặt (Cash)</h4>
                <p className="text-xs text-muted-foreground">
                  Thu tiền tại quầy
                </p>
              </div>
            </div>
            <ToggleSwitch
              name="acceptCash"
              checked={settings.acceptCash !== false}
              onChange={handleToggleChange}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-pink-500/5 border-pink-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#A50064]/15 text-[#A50064] dark:text-pink-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Chuyển khoản / MoMo QR</h4>
                <p className="text-xs text-muted-foreground">
                  Quét mã QR MoMo
                </p>
              </div>
            </div>
            <ToggleSwitch
              name="acceptMomo"
              checked={settings.acceptMomo !== false}
              onChange={handleToggleChange}
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Thẻ Visa / Ghi nợ</h4>
                <p className="text-xs text-muted-foreground">
                  Visa, Mastercard, Debit
                </p>
              </div>
            </div>
            <ToggleSwitch
              name="acceptCard"
              checked={settings.acceptCard !== false}
              onChange={handleToggleChange}
            />
          </div>
        </div>

        {/* 2. Cấu hình Ví điện tử MoMo (QR) */}
        <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/5 via-background to-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#A50064] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                mo<br />mo
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Thông tin nhận tiền Ví MoMo (Mã QR)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Hệ thống tự động tạo mã QR MoMo kèm số tiền đơn hàng khi thu
                  ngân chọn Chuyển khoản / QR
                </p>
              </div>
            </div>
            <Badge className="bg-[#A50064] hover:bg-[#8d0055] text-white">
              MoMo QR
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
                  Tên chủ tài khoản MoMo *
                </label>
                <Input
                  name="momoOwnerName"
                  placeholder="VD: NGUYEN VAN A"
                  value={settings.momoOwnerName || ""}
                  onChange={(e) =>
                    onChange("momoOwnerName", e.target.value.toUpperCase())
                  }
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-1.5">
                  <QrCode className="w-3.5 h-3.5 text-[#A50064]" />
                  Link ảnh QR tùy chỉnh (Tùy chọn — Để trống sẽ tự tạo QR động)
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
                Xem trước Mã QR MoMo
              </div>
              {previewQrUrl ? (
                <img
                  src={previewQrUrl}
                  alt="MoMo QR Preview"
                  className="w-36 h-36 object-contain rounded-lg border p-1 bg-white"
                />
              ) : (
                <div className="w-36 h-36 rounded-lg border border-dashed flex flex-col items-center justify-center p-3 text-xs text-muted-foreground">
                  <QrCode className="w-8 h-8 mb-1.5 opacity-40" />
                  Nhập SĐT MoMo để tạo mã QR
                </div>
              )}
              <div className="mt-2 text-xs font-semibold text-foreground truncate max-w-[160px]">
                {settings.momoOwnerName || "CHỦ VÍ MOMO"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {settings.momoPhone || "Chưa nhập SĐT"}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Cấu hình Thẻ Visa / Thẻ Ghi nợ (Nhận thanh toán thẻ) */}
        <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-background to-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs tracking-tighter">
                VISA
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Thông tin Thẻ Visa / Thẻ Ghi nợ nhận thanh toán của Cửa hàng
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tài khoản/thẻ thụ hưởng khi khách hàng thanh toán bằng thẻ
                  Visa, Mastercard hoặc thẻ ghi nợ tại POS
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
                  Tên chủ thẻ (In hoa không dấu) *
                </label>
                <Input
                  name="cardHolderName"
                  placeholder="VD: NGUYEN VAN A"
                  value={settings.cardHolderName || ""}
                  onChange={(e) =>
                    onChange("cardHolderName", e.target.value.toUpperCase())
                  }
                />
              </div>
            </div>

            {/* Thẻ Visa/Debit mô phỏng trực quan */}
            <div className="md:col-span-2">
              <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 shadow-lg border border-white/10 space-y-5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 truncate max-w-[150px]">
                    {settings.cardBankName || "MERCHANT VISA / DEBIT"}
                  </span>
                  <span className="font-black italic text-lg tracking-wider text-white">
                    VISA
                  </span>
                </div>

                <div className="font-mono text-base sm:text-lg tracking-widest font-semibold text-amber-100">
                  {formatCardNumberDisplay(settings.cardNumber)}
                </div>

                <div className="flex items-end justify-between text-xs pt-1">
                  <div>
                    <div className="text-[10px] uppercase text-blue-300/80">
                      Card Holder
                    </div>
                    <div className="font-semibold tracking-wider uppercase truncate max-w-[150px]">
                      {settings.cardHolderName || "TEN CHU THE"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-blue-300/80">
                      Expires
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

        {onSave && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={onSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Lưu thông tin nhận thanh toán
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentSettings;
