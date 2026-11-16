import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildStockLookupMap,
  computeTransferPreview,
  resolveInventoryProductInfo,
  validateInventoryTransfer,
} from "./inventoryTransferUtils.js";

describe("inventoryTransferUtils", () => {
  it("aggregates duplicate product inventory rows into a stock lookup map", () => {
    const map = buildStockLookupMap([
      { id: 1, productId: 101, quantity: 12 },
      { id: 2, product: { id: 101 }, quantity: 8 },
      { id: 3, productId: "205", quantity: 0 },
      { id: 4, quantity: 5 },
    ]);

    assert.deepEqual(map, { 101: 20, 205: 0 });
    assert.deepEqual(buildStockLookupMap(null), {});
  });

  it("rejects transfer when branches are insufficient, identical, or missing", () => {
    assert.equal(
      validateInventoryTransfer({
        branchCount: 1,
        fromBranchId: "1",
        toBranchId: "2",
        productId: "10",
        quantity: "5",
        availableSourceStock: 50,
      }).valid,
      false,
    );

    const missing = validateInventoryTransfer({
      branchCount: 2,
      fromBranchId: "1",
      toBranchId: "",
      productId: "10",
      quantity: "5",
      availableSourceStock: 50,
    });
    assert.equal(missing.valid, false);
    assert.match(missing.errorTitle, /Thiếu thông tin/);

    const sameBranch = validateInventoryTransfer({
      branchCount: 2,
      fromBranchId: "3",
      toBranchId: "3",
      productId: "10",
      quantity: "5",
      availableSourceStock: 50,
    });
    assert.equal(sameBranch.valid, false);
    assert.match(sameBranch.errorMessage, /phải khác nhau/);
  });

  it("validates positive integer quantity against source branch stock", () => {
    const nonInt = validateInventoryTransfer({
      branchCount: 2,
      fromBranchId: "1",
      toBranchId: "2",
      productId: "10",
      quantity: "2.5",
      availableSourceStock: 20,
    });
    assert.equal(nonInt.valid, false);
    assert.match(nonInt.errorMessage, /số nguyên lớn hơn 0/);

    const overStock = validateInventoryTransfer({
      branchCount: 2,
      fromBranchId: "1",
      toBranchId: "2",
      productId: "10",
      quantity: "25",
      availableSourceStock: 15,
    });
    assert.equal(overStock.valid, false);
    assert.match(overStock.errorMessage, /chỉ còn 15/);

    const ok = validateInventoryTransfer({
      branchCount: 2,
      fromBranchId: "1",
      toBranchId: "2",
      productId: "10",
      quantity: "15",
      availableSourceStock: 15,
    });
    assert.equal(ok.valid, true);
  });

  it("computes source and destination post-transfer balances safely", () => {
    assert.deepEqual(
      computeTransferPreview({
        availableSourceStock: 30,
        currentTargetStock: 4,
        quantity: 12,
      }),
      { validQuantity: 12, nextSourceStock: 18, nextTargetStock: 16 },
    );

    // Invalid over-transfer clamps validQuantity preview to 0
    assert.deepEqual(
      computeTransferPreview({
        availableSourceStock: 10,
        currentTargetStock: 4,
        quantity: 99,
      }),
      { validQuantity: 0, nextSourceStock: 10, nextTargetStock: 4 },
    );
  });

  it("resolves display metadata from nested product or fallback catalog", () => {
    const info = resolveInventoryProductInfo(
      { id: 9, productId: 55, quantity: 14, minStockLevel: 5 },
      [{ id: 55, name: "Áo Blazer Linen", sku: "BLZ-M-KEM", categoryId: 2, sellingPrice: 890000 }],
      [{ id: 2, name: "Áo khoác" }],
    );

    assert.equal(info.productId, 55);
    assert.equal(info.name, "Áo Blazer Linen");
    assert.equal(info.sku, "BLZ-M-KEM");
    assert.equal(info.category, "Áo khoác");
    assert.equal(info.quantity, 14);
    assert.equal(info.minStockLevel, 5);
  });
});
