import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderPayload,
  buildPaymentNote,
  computeCashPaymentMetrics,
  computeLoyaltySummary,
  filterEnabledPaymentMethods,
  getCashQuickPresets,
  resolveMerchantPaymentInfo,
} from "./paymentDialogUtils.js";

describe("paymentDialogUtils", () => {
  it("filters enabled payment methods and falls back when all disabled", () => {
    const onlyCash = filterEnabledPaymentMethods({
      acceptCash: true,
      acceptMomo: false,
      acceptCard: false,
    });
    assert.deepEqual(
      onlyCash.map((m) => m.id),
      ["CASH"],
    );

    const allFallback = filterEnabledPaymentMethods({
      acceptCash: false,
      acceptMomo: false,
      acceptCard: false,
    });
    assert.equal(allFallback.length, 3);
  });

  it("computes loyalty redemption caps and projected points", () => {
    const customer = { loyaltyPoints: 120 };
    const summary = computeLoyaltySummary({
      selectedCustomer: customer,
      couponCode: "POINTS",
      subTotal: 85500, // max 85 points redeemable at 1000 VND/pt
      total: 42000, // earns floor(42000 / 10000) = 4 pts
    });

    assert.equal(summary.availablePoints, 120);
    assert.equal(summary.isRedeemingPoints, true);
    assert.equal(summary.pointsUsed, 85);
    assert.equal(summary.earnedPoints, 4);
    assert.equal(summary.projectedPoints, 39);

    const guestSummary = computeLoyaltySummary({
      selectedCustomer: null,
      couponCode: "SALE10",
      subTotal: 200000,
      total: 180000,
    });
    assert.equal(guestSummary.pointsUsed, 0);
    assert.equal(guestSummary.earnedPoints, 0);
    assert.equal(guestSummary.projectedPoints, 0);
  });

  it("computes cash change, insufficient cash flag, and quick presets", () => {
    const paidMore = computeCashPaymentMetrics({
      normalizedMethod: "CASH",
      cashReceived: "200000",
      total: 155000,
    });
    assert.equal(paidMore.changeAmount, 45000);
    assert.equal(paidMore.isInsufficientCash, false);

    const underpaid = computeCashPaymentMetrics({
      normalizedMethod: "CASH",
      cashReceived: "100000",
      total: 155000,
    });
    assert.equal(underpaid.changeAmount, 0);
    assert.equal(underpaid.isInsufficientCash, true);

    const emptyCash = computeCashPaymentMetrics({
      normalizedMethod: "CASH",
      cashReceived: "",
      total: 155000,
    });
    assert.equal(emptyCash.isInsufficientCash, false);

    assert.deepEqual(getCashQuickPresets(155000), [
      155000, 200000, 500000, 1000000,
    ]);
    assert.deepEqual(getCashQuickPresets(100000), [
      100000, 200000, 500000, 1000000,
    ]);
  });

  it("resolves merchant payment display with store fallbacks", () => {
    const info = resolveMerchantPaymentInfo({
      paymentInfo: { cardNumber: "4221567890128899" },
      store: { brand: "Zosh Boutique", contact: { phone: "0912345678" } },
    });

    assert.equal(info.momoPhone, "0912345678");
    assert.equal(info.momoOwnerName, "ZOSH BOUTIQUE");
    assert.equal(info.storeCardBank, "MB Bank");
    assert.equal(info.storeCardMasked, "•••• 8899");
  });

  it("builds third-party payment tags into order notes", () => {
    const cardNote = buildPaymentNote({
      baseNote: "Khách VIP",
      normalizedMethod: "CARD",
      thirdPartyInfo: {
        transactionId: "AUTH-777",
        cardBrand: "VISA",
        maskedCardNumber: "•••• 4829",
      },
      cardNumber: "4221 5678 9012 4829",
    });
    assert.equal(
      cardNote,
      "Khách VIP [VISA •••• 4829 - Mã chuẩn chi: AUTH-777]",
    );

    const upiNote = buildPaymentNote({
      baseNote: "",
      normalizedMethod: "UPI",
      momoPhone: "0901234567",
      gatewaySessionReferenceCode: "POS-555",
    });
    assert.equal(upiNote, "[MoMo/VietQR 0901234567 - Mã GD: POS-555]");
  });

  it("builds order payload matching backend OrderDTO contract", () => {
    const payload = buildOrderPayload({
      subTotal: 250000,
      taxAmount: 25000,
      discountAmount: 10000,
      couponCode: "VIP10",
      total: 265000,
      branchId: 3,
      cashierId: 9,
      selectedCustomer: { id: 42 },
      cart: [
        { id: 1, quantity: 2, sellingPrice: 100000 },
        { id: 2, quantity: 1, price: 50000 },
      ],
      paymentType: "UPI",
      status: "PENDING",
      paymentSessionId: "SES-1",
      note: "Giao gấp",
    });

    assert.equal(payload.branchId, 3);
    assert.equal(payload.customerId, 42);
    assert.equal(payload.status, "PENDING");
    assert.equal(payload.paymentSessionId, "SES-1");
    assert.deepEqual(payload.items, [
      { productId: 1, quantity: 2, price: 200000 },
      { productId: 2, quantity: 1, price: 50000 },
    ]);
  });
});
