export const DEFAULT_VIETQR_BANK_BIN = "970422";

export const SAMPLE_VISA_CARD = {
  cardNumber: "4221 5678 9012 4829",
  cardExpiry: "08/29",
  cardCvv: "889",
};

export function detectCardBrand(num) {
  const clean = String(num || "").replace(/\D/g, "");
  if (clean.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "MASTERCARD";
  if (clean.startsWith("35")) return "JCB";
  if (clean.startsWith("9704")) return "NAPAS DEBIT";
  return "VISA / DEBIT";
}

export function formatCardNumberInput(val) {
  const digits = String(val || "").replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiryInput(val) {
  const digits = String(val || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export function sanitizeCvvInput(val) {
  return String(val || "").replace(/\D/g, "").slice(0, 4);
}

export function maskCardTail(rawNumber, fallback = "") {
  const digits = String(rawNumber || "").replace(/\D/g, "");
  if (!digits) return fallback;
  return `•••• ${digits.slice(-4)}`;
}

export function formatVnd(amount) {
  return `₫${Number(amount || 0).toLocaleString("vi-VN")}`;
}

export function mergeGatewaySession(prev, next) {
  if (!next || typeof next !== "object") {
    return next ?? null;
  }
  return {
    ...next,
    webhookToken: next.webhookToken || prev?.webhookToken,
  };
}

export function buildVietQrFallbackUrl({
  bankBin = DEFAULT_VIETQR_BANK_BIN,
  phone,
  amount = 0,
  addInfo = "POS THANH TOAN",
  accountName = "POS STORE",
}) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  const normalizedBin = bankBin || DEFAULT_VIETQR_BANK_BIN;
  const safeAmount = Math.max(0, Math.round(Number(amount || 0)));
  return `https://img.vietqr.io/image/${normalizedBin}-${cleanPhone}-compact2.png?amount=${safeAmount}&addInfo=${encodeURIComponent(
    addInfo || "POS THANH TOAN",
  )}&accountName=${encodeURIComponent(accountName || "POS STORE")}`;
}

export function resolveActiveQrImageUrl({
  customQrImage,
  qrMode,
  gatewaySession,
  bankBin,
  phone,
  amount,
  defaultAddInfo,
  accountName,
}) {
  const trimmedCustom = customQrImage?.trim();
  if (trimmedCustom) return trimmedCustom;

  if (qrMode === "MOBILE_GATEWAY" && gatewaySession?.qrImageForMobileCheckout) {
    return gatewaySession.qrImageForMobileCheckout;
  }

  if (gatewaySession?.vietQrImageUrl) {
    return gatewaySession.vietQrImageUrl;
  }

  return buildVietQrFallbackUrl({
    bankBin: gatewaySession?.bankBin || bankBin || DEFAULT_VIETQR_BANK_BIN,
    phone,
    amount,
    addInfo: gatewaySession?.referenceCode || defaultAddInfo,
    accountName,
  });
}
