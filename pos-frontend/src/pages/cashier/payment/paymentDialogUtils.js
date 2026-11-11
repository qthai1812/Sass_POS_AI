import {
  detectCardBrand,
  maskCardTail,
} from "../../../utils/paymentGatewayUtils.js";

export const EMPTY_PAYMENT_INFO = {};
export const VND_PER_POINT_EARNED = 10000; // 10.000₫ = +1 điểm
export const VND_PER_POINT_REDEEMED = 1000; // 1 điểm = 1.000₫

export const PAYMENT_METHOD_DEFINITIONS = [
  {
    id: "CASH",
    configKey: "acceptCash",
    label: "Tiền mặt (Cash)",
    subLabel: "Thu tiền mặt tại quầy",
    activeClass:
      "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  {
    id: "UPI",
    configKey: "acceptMomo",
    label: "Chuyển khoản / QR MoMo",
    subLabel: "Tự động nhận thông báo QR",
    activeClass:
      "border-[#A50064] bg-pink-50 text-[#A50064] dark:bg-pink-950/50 dark:text-pink-200",
  },
  {
    id: "CARD",
    configKey: "acceptCard",
    label: "Thẻ Visa / Thẻ ghi nợ",
    subLabel: "Cổng 3D-Secure tự động",
    activeClass:
      "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  },
];

export function filterEnabledPaymentMethods(
  paymentInfo,
  definitions = PAYMENT_METHOD_DEFINITIONS,
) {
  const info = paymentInfo || EMPTY_PAYMENT_INFO;
  const filtered = definitions.filter((m) => info[m.configKey] !== false);
  return filtered.length > 0 ? filtered : definitions;
}

export function computeLoyaltySummary({
  selectedCustomer,
  couponCode,
  subTotal,
  total,
}) {
  const availablePoints = Math.max(
    0,
    Number(selectedCustomer?.loyaltyPoints || 0),
  );
  const isRedeemingPoints = couponCode === "POINTS";
  const pointsUsed = isRedeemingPoints
    ? Math.min(
        availablePoints,
        Math.floor(Math.max(0, subTotal || 0) / VND_PER_POINT_REDEEMED),
      )
    : 0;
  const earnedPoints = selectedCustomer
    ? Math.floor(Math.max(0, total || 0) / VND_PER_POINT_EARNED)
    : 0;
  const projectedPoints = Math.max(
    0,
    availablePoints - pointsUsed + earnedPoints,
  );

  return {
    availablePoints,
    isRedeemingPoints,
    pointsUsed,
    earnedPoints,
    projectedPoints,
  };
}

export function computeCashPaymentMetrics({
  normalizedMethod,
  cashReceived,
  total,
}) {
  const numericCashReceived = parseFloat(cashReceived) || 0;
  const safeTotal = Number(total || 0);
  const changeAmount =
    normalizedMethod === "CASH" && numericCashReceived > safeTotal
      ? numericCashReceived - safeTotal
      : 0;
  const isInsufficientCash =
    normalizedMethod === "CASH" &&
    cashReceived !== "" &&
    Number(cashReceived) < safeTotal;

  return {
    numericCashReceived,
    changeAmount,
    isInsufficientCash,
  };
}

export function getCashQuickPresets(total) {
  const safeTotal = total || 0;
  const exactRounded = Math.ceil(safeTotal);
  return [exactRounded, 100000, 200000, 500000, 1000000]
    .filter((v, idx, arr) => v >= safeTotal && arr.indexOf(v) === idx)
    .slice(0, 4);
}

export function resolveMerchantPaymentInfo({ paymentInfo, store }) {
  const info = paymentInfo || EMPTY_PAYMENT_INFO;
  const momoPhone =
    info.momoPhone?.trim() || store?.contact?.phone || "0901234567";
  const momoOwnerName =
    info.momoOwnerName?.trim() ||
    store?.brand?.toUpperCase() ||
    "POS PRO STORE";
  const storeCardBank = info.cardBankName || "MB Bank";
  const storeCardHolder =
    info.cardOwnerName ||
    info.cardHolderName ||
    momoOwnerName ||
    "POS PRO MERCHANT";
  const rawCardAccount = info.cardAccountNumber || info.cardNumber;
  const storeCardMasked = maskCardTail(
    rawCardAccount,
    "Cổng Visa/Mastercard POS",
  );

  return {
    momoPhone,
    momoOwnerName,
    storeCardBank,
    storeCardHolder,
    storeCardMasked,
    gatewayBankAccount:
      info.cardAccountNumber || info.cardNumber || momoPhone,
  };
}

export function buildPaymentNote({
  baseNote,
  normalizedMethod,
  thirdPartyInfo,
  cardNumber,
  momoPhone,
  gatewaySessionReferenceCode,
}) {
  let paymentNote = baseNote || "";
  if (normalizedMethod === "CARD") {
    const txId = thirdPartyInfo?.transactionId || "VISA-3DS-OK";
    const masked =
      thirdPartyInfo?.maskedCardNumber || maskCardTail(cardNumber, "•••• ");
    const brand = thirdPartyInfo?.cardBrand || detectCardBrand(cardNumber);
    const tag = `[${brand} ${masked} - Mã chuẩn chi: ${txId}]`;
    paymentNote = paymentNote ? `${paymentNote} ${tag}` : tag;
  } else if (normalizedMethod === "UPI") {
    const txId =
      thirdPartyInfo?.transactionId ||
      gatewaySessionReferenceCode ||
      "MOMO-IPN";
    const tag = `[MoMo/VietQR ${momoPhone} - Mã GD: ${txId}]`;
    paymentNote = paymentNote ? `${paymentNote} ${tag}` : tag;
  }
  return paymentNote;
}

export function buildOrderPayload({
  subTotal,
  taxAmount,
  discountAmount,
  couponCode,
  total,
  branchId,
  cashierId,
  selectedCustomer,
  cart,
  paymentType,
  paymentSessionId,
  status,
  note,
}) {
  const payload = {
    subTotal,
    taxAmount,
    discountAmount,
    couponCode: couponCode || null,
    totalAmount: total,
    branchId,
    cashierId,
    customerId: selectedCustomer?.id || null,
    customer: selectedCustomer || null,
    items: (cart || []).map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      price:
        (item.sellingPrice ?? item.price ?? 0) * Number(item.quantity || 1),
    })),
    paymentType,
    note: note || "",
  };

  if (status) {
    payload.status = status;
  }
  if (paymentSessionId !== undefined) {
    payload.paymentSessionId = paymentSessionId;
  }
  return payload;
}
