import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVietQrFallbackUrl,
  detectCardBrand,
  formatCardNumberInput,
  formatExpiryInput,
  maskCardTail,
  mergeGatewaySession,
  resolveActiveQrImageUrl,
  sanitizeCvvInput,
} from "./paymentGatewayUtils.js";

describe("paymentGatewayUtils", () => {
  it("detects common card brands including Napas Debit", () => {
    assert.equal(detectCardBrand("4221 5678 9012 4829"), "VISA");
    assert.equal(detectCardBrand("5412 0000"), "MASTERCARD");
    assert.equal(detectCardBrand("2221 9999"), "MASTERCARD");
    assert.equal(detectCardBrand("3528 1111"), "JCB");
    assert.equal(detectCardBrand("9704 2200 1234"), "NAPAS DEBIT");
    assert.equal(detectCardBrand("6011 0000"), "VISA / DEBIT");
    assert.equal(detectCardBrand(null), "VISA / DEBIT");
  });

  it("formats card numbers, expiry dates, and CVV safely", () => {
    assert.equal(
      formatCardNumberInput("4221abcd567890124829999"),
      "4221 5678 9012 4829",
    );
    assert.equal(formatExpiryInput("082912"), "08/29");
    assert.equal(formatExpiryInput("08"), "08");
    assert.equal(sanitizeCvvInput("12a34b5"), "1234");
  });

  it("masks card numbers or returns fallback when empty", () => {
    assert.equal(maskCardTail("4221 5678 9012 4829", "NONE"), "•••• 4829");
    assert.equal(maskCardTail("", "Fallback POS"), "Fallback POS");
    assert.equal(maskCardTail(null, "Fallback POS"), "Fallback POS");
  });

  it("preserves previous webhookToken when merging session updates", () => {
    const prev = { sessionId: "S1", status: "PENDING", webhookToken: "sec-123" };
    const polled = { sessionId: "S1", status: "SUCCESS" };

    const merged = mergeGatewaySession(prev, polled);
    assert.equal(merged.status, "SUCCESS");
    assert.equal(merged.webhookToken, "sec-123");

    const rotated = mergeGatewaySession(prev, {
      sessionId: "S1",
      status: "FAILED",
      webhookToken: "sec-999",
    });
    assert.equal(rotated.webhookToken, "sec-999");
    assert.equal(mergeGatewaySession(prev, null), null);
  });

  it("resolves active QR URL according to priority rules", () => {
    const baseArgs = {
      customQrImage: "  https://cdn.example/custom-qr.png ",
      qrMode: "MOBILE_GATEWAY",
      gatewaySession: {
        qrImageForMobileCheckout: "https://gateway/mobile-qr.png",
        vietQrImageUrl: "https://gateway/vietqr.png",
        referenceCode: "ORDER-88",
        bankBin: "970436",
      },
      phone: "090-123-4567",
      amount: 150000.6,
      defaultAddInfo: "POS THANH TOAN",
      accountName: "FASHION SHOP",
    };

    assert.equal(
      resolveActiveQrImageUrl(baseArgs),
      "https://cdn.example/custom-qr.png",
    );
    assert.equal(
      resolveActiveQrImageUrl({ ...baseArgs, customQrImage: "" }),
      "https://gateway/mobile-qr.png",
    );
    assert.equal(
      resolveActiveQrImageUrl({
        ...baseArgs,
        customQrImage: "",
        qrMode: "VIETQR",
      }),
      "https://gateway/vietqr.png",
    );

    const fallback = resolveActiveQrImageUrl({
      ...baseArgs,
      customQrImage: "",
      qrMode: "VIETQR",
      gatewaySession: { referenceCode: "REF 99", bankBin: "970436" },
    });
    assert.ok(fallback.includes("970436-0901234567-compact2.png"));
    assert.ok(fallback.includes("amount=150001"));
    assert.ok(fallback.includes("addInfo=REF%2099"));
    assert.ok(
      buildVietQrFallbackUrl({ phone: "0988", amount: 50000 }).includes(
        "970422-0988-compact2.png",
      ),
    );
  });
});
