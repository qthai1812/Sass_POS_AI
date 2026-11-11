import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterVisiblePlans,
  findCurrentSubscription,
  getSwitchBlocker,
  isPlanCurrent,
  normalizeSubscriptionGateway,
  resolvePlatformPaymentDisplay,
} from "./upgradeUtils.js";

describe("upgradeUtils", () => {
  it("finds active or trial subscription for a store and checks current plan", () => {
    const subs = [
      { id: 1, storeId: 10, status: "EXPIRED", planId: 2 },
      { id: 2, store: { id: 10 }, status: "TRIAL", planId: 3, planName: "Pro" },
    ];
    const current = findCurrentSubscription(subs, 10);
    assert.equal(current.id, 2);
    assert.equal(isPlanCurrent(current, { id: "3", name: "Other" }), true);
    assert.equal(isPlanCurrent(current, { id: 99, name: "pro" }), true);
    assert.equal(isPlanCurrent(current, { id: 99, name: "Basic" }), false);
  });

  it("filters out inactive plans unless currently subscribed", () => {
    const current = { planId: 2, planName: "Legacy" };
    const plans = [
      { id: 1, name: "Starter", active: true },
      { id: 2, name: "Legacy", active: false },
      { id: 3, name: "Archived", active: false },
    ];
    const visible = filterVisiblePlans(plans, current);
    assert.deepEqual(
      visible.map((p) => p.id),
      [1, 2],
    );
  });

  it("blocks plan downgrade when store usage exceeds target plan quotas", () => {
    const usage = {
      usedBranches: 3,
      usedUsers: 12,
      usedProducts: 250,
    };

    assert.match(
      getSwitchBlocker(
        { name: "Starter", maxBranches: 1, multiLocation: true, maxUsers: 20, maxProducts: 500 },
        usage,
      ),
      /tối đa 1 chi nhánh/,
    );
    assert.match(
      getSwitchBlocker(
        { name: "Single", maxBranches: 0, multiLocation: false, maxUsers: 20, maxProducts: 500 },
        usage,
      ),
      /Multi-location/,
    );
    assert.match(
      getSwitchBlocker(
        { name: "Team", maxBranches: 5, multiLocation: true, maxUsers: 10, maxProducts: 500 },
        usage,
      ),
      /tối đa 10 nhân sự/,
    );
    assert.match(
      getSwitchBlocker(
        { name: "Catalog", maxBranches: 5, multiLocation: true, maxUsers: 20, maxProducts: 100 },
        usage,
      ),
      /tối đa 100 sản phẩm/,
    );

    assert.equal(
      getSwitchBlocker(
        { name: "Enterprise", maxBranches: 0, multiLocation: true, maxUsers: 0, maxProducts: 0 },
        usage,
      ),
      null,
    );
  });

  it("resolves platform payment display and avoids masked placeholder bank account", () => {
    const maskedConfig = resolvePlatformPaymentDisplay({
      momoPhone: "0988777666",
      cardNumber: "•••• 1234",
    });
    assert.equal(maskedConfig.platformCardMasked, "•••• 1234");
    assert.equal(maskedConfig.safeBankAccount, "0988777666");

    const rawConfig = resolvePlatformPaymentDisplay({
      momoPhone: "0988777666",
      cardNumber: "4221567890124455",
      cardBankName: "ACB",
    });
    assert.equal(rawConfig.platformCardMasked, "•••• 4455");
    assert.equal(rawConfig.safeBankAccount, "4221567890124455");
    assert.equal(rawConfig.platformBankName, "ACB");
  });

  it("normalizes gateway identifier", () => {
    assert.equal(normalizeSubscriptionGateway("MOMO"), "MOMO");
    assert.equal(normalizeSubscriptionGateway("VISA"), "VISA");
    assert.equal(normalizeSubscriptionGateway("OTHER"), "RAZORPAY");
  });
});
