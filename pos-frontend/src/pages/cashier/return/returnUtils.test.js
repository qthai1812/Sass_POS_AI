import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReturnableItems,
  calculateItemizedRefundSummary,
  clampReturnQuantities,
  getHistoricalUnitPrice,
  mergeOrderRefunds,
  normalizeRefundError,
  validateRefundSubmission,
} from "./returnUtils.js";

describe("returnUtils", () => {
  it("prioritizes historical OrderItem line price over mutable catalog sellingPrice", () => {
    const orderItem = {
      id: 1,
      quantity: 2,
      price: 1180000, // 590,000 each at purchase time
      product: { id: 10, name: "Jeans", sellingPrice: 650000 },
    };
    assert.equal(getHistoricalUnitPrice(orderItem), 590000);

    const legacyItemWithoutPrice = {
      id: 2,
      quantity: 1,
      price: null,
      product: { id: 11, name: "Hat", sellingPrice: 120000 },
    };
    assert.equal(getHistoricalUnitPrice(legacyItemWithoutPrice), 120000);
  });

  it("merges refundsByOrder and refundsByBranch by orderId without duplicates", () => {
    const byOrder = [
      { id: 101, orderId: 1501, amount: 110000 },
      { id: 999, orderId: 1400, amount: 50000 }, // belongs to a previously viewed order
    ];
    const byBranch = [
      { id: 101, orderId: 1501, amount: 999999 }, // older duplicate id
      { id: 102, orderId: 1501, amount: 200000 },
      { id: 103, orderId: 1502, amount: 300000 },
    ];

    const merged = mergeOrderRefunds(1501, byOrder, byBranch);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((r) => ({ id: r.id, amount: r.amount })),
      [
        { id: 101, amount: 110000 },
        { id: 102, amount: 200000 },
      ],
    );
  });

  it("builds returnable items with tax/discount netOrderFactor and FIFO legacy product fallback", () => {
    const order = {
      id: 1501,
      subTotal: 400000,
      totalAmount: 440000, // +10% VAT => factor 1.1
      items: [
        {
          id: 11,
          quantity: 2,
          price: 200000,
          product: { id: 1, name: "Polo", sellingPrice: 150000 },
        },
        {
          id: 12,
          quantity: 2,
          price: 200000,
          product: { id: 2, name: "Pants", sellingPrice: 100000 },
        },
      ],
    };

    const existingRefunds = [
      {
        id: 700,
        orderId: 1501,
        amount: 110000,
        items: [
          { orderItemId: 11, productId: 1, quantity: 1 },
          { orderItemId: null, productId: 2, quantity: 1 }, // legacy item without orderItemId
        ],
      },
    ];

    const summary = buildReturnableItems(order, existingRefunds);
    assert.equal(summary.alreadyRefunded, 110000);
    assert.equal(summary.remainingRefundable, 330000);
    assert.equal(summary.netOrderFactor, 1.1);
    assert.equal(summary.returnableItems[0].remainingQty, 1);
    assert.equal(summary.returnableItems[1].remainingQty, 1);
    assert.equal(summary.returnableItems[0].rawUnitPrice, 100000);
    assert.equal(Math.round(summary.returnableItems[0].netUnitPrice), 110000);
  });

  it("defaults new orders to 0 quantities and clamps updated quantities when remainingQty shrinks", () => {
    const returnable = [
      { orderItemId: 11, remainingQty: 2 },
      { orderItemId: 12, remainingQty: 1 },
    ];

    const initial = clampReturnQuantities({}, returnable, true);
    assert.deepEqual(initial, { 11: 0, 12: 0 });

    const shrunk = clampReturnQuantities(
      { 11: 3, 12: 1 },
      [
        { orderItemId: 11, remainingQty: 1 },
        { orderItemId: 12, remainingQty: 0 },
      ],
      true,
    );
    assert.deepEqual(shrunk, { 11: 1, 12: 0 });
  });

  it("computes partial itemized refund cleanly and snaps final remaining within rounding tolerance without leaking fee deductions", () => {
    // 3 equal net items summing to 100,000 total => 33,333.33 each; final step has 0.01 rounding delta
    const items = [
      {
        orderItemId: 1,
        productId: 10,
        productName: "Socks",
        remainingQty: 1,
        netUnitPrice: 33333.33,
      },
      {
        orderItemId: 2,
        productId: 11,
        productName: "Tee",
        remainingQty: 1,
        netUnitPrice: 33333.33,
      },
    ];

    const partial = calculateItemizedRefundSummary(
      items,
      { 1: 1, 2: 0 },
      66666.67,
    );
    assert.equal(partial.totalSelectedQty, 1);
    assert.equal(partial.returningAllRemaining, false);
    assert.equal(partial.calculatedRefundAmount, 33333.33);
    assert.equal(partial.maxAllowedForItemized, 33333.33);

    const finalWithRounding = calculateItemizedRefundSummary(
      items,
      { 1: 1, 2: 1 },
      66666.67,
    );
    assert.equal(finalWithRounding.returningAllRemaining, true);
    assert.equal(finalWithRounding.calculatedRefundAmount, 66666.67);

    // Earlier return deducted a 50,000 restocking fee, leaving remainingRefundable = 300,000
    // while final remaining item is worth 250,000 -> default stays 250,000, maxAllowed allows 300,000
    const finalAfterFee = calculateItemizedRefundSummary(
      [
        {
          orderItemId: 3,
          productId: 12,
          productName: "Jacket",
          remainingQty: 1,
          netUnitPrice: 250000,
        },
      ],
      { 3: 1 },
      300000,
    );
    assert.equal(finalAfterFee.returningAllRemaining, true);
    assert.equal(finalAfterFee.calculatedRefundAmount, 250000);
    assert.equal(finalAfterFee.maxAllowedForItemized, 300000);
  });

  it("validates shift requirement, partial amount-only mode, limits, and reasons", () => {
    const noShift = validateRefundSubmission({
      refundMode: "ITEMS",
      remainingRefundable: 200000,
      totalSelectedQty: 1,
      refundAmount: 100000,
      maxAllowedAmount: 100000,
      finalReason: "Damaged product",
      isCashier: true,
      hasActiveShift: false,
    });
    assert.equal(noShift.valid, false);
    assert.equal(noShift.title, "Active Shift Required");

    const amountOnlyValid = validateRefundSubmission({
      refundMode: "AMOUNT",
      remainingRefundable: 200000,
      totalSelectedQty: 0,
      refundAmount: 50000,
      maxAllowedAmount: 200000,
      finalReason: "Goodwill compensation",
      isCashier: true,
      hasActiveShift: true,
    });
    assert.equal(amountOnlyValid.valid, true);

    const amountTooHigh = validateRefundSubmission({
      refundMode: "AMOUNT",
      remainingRefundable: 200000,
      totalSelectedQty: 0,
      refundAmount: 250000,
      maxAllowedAmount: 200000,
      finalReason: "Pricing error",
      isCashier: false,
      hasActiveShift: false,
    });
    assert.equal(amountTooHigh.valid, false);
    assert.equal(amountTooHigh.field, "amount");
    assert.equal(amountTooHigh.title, "Amount Exceeds Limit");

    const missingReason = validateRefundSubmission({
      refundMode: "ITEMS",
      remainingRefundable: 200000,
      totalSelectedQty: 1,
      refundAmount: 100000,
      maxAllowedAmount: 100000,
      finalReason: "",
      isCashier: true,
      hasActiveShift: true,
    });
    assert.equal(missingReason.valid, false);
    assert.equal(missingReason.field, "reason");
    assert.equal(missingReason.title, "Missing Return Reason");
  });

  it("normalizes error payloads into readable strings", () => {
    assert.equal(normalizeRefundError("Shift missing"), "Shift missing");
    assert.equal(
      normalizeRefundError({ response: { data: { message: "Forbidden" } } }),
      "Forbidden",
    );
    assert.equal(
      normalizeRefundError({ message: "Network error" }),
      "Network error",
    );
    assert.equal(
      normalizeRefundError({}, "Fallback message"),
      "Fallback message",
    );
  });
});
