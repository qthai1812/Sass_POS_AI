const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;

export const ROUNDING_SNAP_TOLERANCE = 10;

export function getHistoricalUnitPrice(item) {
  if (!item) return 0;
  const qty = Number(item.quantity || 0);
  if (item.price != null && qty > 0) {
    const unit = Number(item.price) / qty;
    if (Number.isFinite(unit)) return unit;
  }
  const fallback = Number(item.product?.sellingPrice ?? item.price ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function mergeOrderRefunds(
  orderId,
  refundsByOrder = [],
  refundsByBranch = [],
) {
  if (orderId == null) return [];
  const targetId = Number(orderId);
  const seenIds = new Set();
  const merged = [];

  const appendMatching = (list) => {
    for (const refund of list || []) {
      if (!refund || Number(refund.orderId) !== targetId) continue;
      if (refund.id != null) {
        const rid = Number(refund.id);
        if (seenIds.has(rid)) continue;
        seenIds.add(rid);
      }
      merged.push(refund);
    }
  };

  // Prefer fresher order-specific refund records, then merge branch cache.
  appendMatching(refundsByOrder);
  appendMatching(refundsByBranch);
  return merged;
}

export function buildReturnableItems(order, orderRefunds = []) {
  const orderItems = order?.items || [];
  const orderTotal = Number(order?.totalAmount || 0);
  const rawSubTotal = Number(order?.subTotal || 0);
  const effectiveSubTotal = rawSubTotal > 0 ? rawSubTotal : orderTotal;
  const netOrderFactor =
    effectiveSubTotal > 0 ? orderTotal / effectiveSubTotal : 1.0;

  let refundedSum = 0;
  const returnedByItem = new Map();
  const returnedByProduct = new Map();

  for (const refund of orderRefunds || []) {
    refundedSum += Number(refund?.amount || 0);
    for (const ri of refund?.items || []) {
      const q = Number(ri?.quantity || 0);
      if (q <= 0) continue;
      if (ri.orderItemId != null) {
        returnedByItem.set(
          ri.orderItemId,
          (returnedByItem.get(ri.orderItemId) || 0) + q,
        );
      } else if (ri.productId != null) {
        returnedByProduct.set(
          ri.productId,
          (returnedByProduct.get(ri.productId) || 0) + q,
        );
      }
    }
  }

  const returnedByOrderItemId = new Map();
  const returnableItems = orderItems.map((oi) => {
    const orderedQty = Number(oi.quantity || 0);
    const directReturned = Number(returnedByItem.get(oi.id) || 0);
    let prevReturned = Math.min(orderedQty, directReturned);
    const productId = oi.product?.id ?? oi.productId ?? null;
    if (prevReturned < orderedQty && productId != null) {
      const fallbackQty = returnedByProduct.get(productId) || 0;
      if (fallbackQty > 0) {
        const take = Math.min(orderedQty - prevReturned, fallbackQty);
        prevReturned += take;
        returnedByProduct.set(productId, fallbackQty - take);
      }
    }
    returnedByOrderItemId.set(oi.id, prevReturned);

    const remainingQty = Math.max(0, orderedQty - prevReturned);
    const rawUnitPrice = getHistoricalUnitPrice(oi);
    const netUnitPrice = rawUnitPrice * netOrderFactor;

    return {
      orderItemId: oi.id,
      productId,
      productName: oi.product?.name || oi.productName || "Deleted Product",
      orderedQty,
      prevReturned,
      remainingQty,
      rawUnitPrice,
      netUnitPrice,
    };
  });

  return {
    alreadyRefunded: round2(refundedSum),
    remainingRefundable: Math.max(0, round2(orderTotal - refundedSum)),
    netOrderFactor,
    returnableItems,
    returnedByOrderItemId,
  };
}

export function clampReturnQuantities(
  prevQuantities = {},
  returnableItems = [],
  initializeFromZero = true,
) {
  const next = {};
  for (const item of returnableItems || []) {
    const hasPrev =
      prevQuantities != null &&
      Object.prototype.hasOwnProperty.call(prevQuantities, item.orderItemId);
    const rawQty = hasPrev
      ? Number(prevQuantities[item.orderItemId] || 0)
      : initializeFromZero
        ? 0
        : item.remainingQty;
    const safeInt = Number.isFinite(rawQty) ? Math.floor(rawQty) : 0;
    next[item.orderItemId] = Math.max(0, Math.min(item.remainingQty, safeInt));
  }
  return next;
}

export function calculateItemizedRefundSummary(
  returnableItems = [],
  returnQuantities = {},
  remainingRefundable = 0,
) {
  const payload = [];
  const receiptItems = [];
  let selectedCount = 0;
  let allRemaining = (returnableItems || []).length > 0;
  let sumNetLines = 0;

  for (const item of returnableItems || []) {
    const rawQty = Number(returnQuantities?.[item.orderItemId] ?? 0);
    const qty = Math.max(
      0,
      Math.min(
        item.remainingQty,
        Number.isFinite(rawQty) ? Math.floor(rawQty) : 0,
      ),
    );
    if (qty < item.remainingQty) {
      allRemaining = false;
    }
    if (qty > 0) {
      selectedCount += qty;
      const lineAmount = round2(item.netUnitPrice * qty);
      sumNetLines += lineAmount;
      payload.push({
        orderItemId: item.orderItemId,
        productId: item.productId,
        quantity: qty,
      });
      receiptItems.push({
        orderItemId: item.orderItemId,
        productId: item.productId,
        productName: item.productName,
        quantity: qty,
        unitPrice: round2(item.netUnitPrice),
        refundAmount: lineAmount,
      });
    }
  }

  const returningAllRemaining = allRemaining && selectedCount > 0;
  const itemsRefundValue = round2(sumNetLines);
  const safeRemaining = Math.max(0, round2(remainingRefundable));

  let calculatedRefundAmount = 0;
  if (selectedCount > 0) {
    if (
      returningAllRemaining &&
      Math.abs(safeRemaining - itemsRefundValue) <= ROUNDING_SNAP_TOLERANCE
    ) {
      calculatedRefundAmount = safeRemaining;
    } else {
      calculatedRefundAmount = Math.min(safeRemaining, itemsRefundValue);
    }
  }

  const maxAllowedForItemized =
    selectedCount === 0
      ? 0
      : returningAllRemaining
        ? safeRemaining
        : Math.min(safeRemaining, itemsRefundValue);

  return {
    selectedItemsPayload: payload,
    selectedReceiptItems: receiptItems,
    totalSelectedQty: selectedCount,
    returningAllRemaining,
    itemsRefundValue,
    calculatedRefundAmount,
    maxAllowedForItemized,
  };
}

export function validateRefundSubmission({
  refundMode,
  remainingRefundable,
  totalSelectedQty,
  refundAmount,
  maxAllowedAmount,
  finalReason,
  isCashier = false,
  hasActiveShift = true,
}) {
  if (isCashier && !hasActiveShift) {
    return {
      valid: false,
      field: "shift",
      title: "Active Shift Required",
      description:
        "Vui lòng bắt đầu ca làm việc (Start Shift) trước khi thực hiện hoàn tiền.",
    };
  }
  if (Number(remainingRefundable || 0) <= 0) {
    return {
      valid: false,
      field: "order",
      title: "Already Refunded",
      description: "This order has no remaining refundable balance.",
    };
  }
  if (refundMode === "ITEMS" && Number(totalSelectedQty || 0) <= 0) {
    return {
      valid: false,
      field: "items",
      title: "No Items Selected",
      description: "Please select at least 1 item quantity to return.",
    };
  }
  const amt = Number(refundAmount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      valid: false,
      field: "amount",
      title: "Invalid Refund Amount",
      description: "Refund amount must be greater than 0.",
    };
  }
  if (maxAllowedAmount != null && amt > Number(maxAllowedAmount) + 0.01) {
    return {
      valid: false,
      field: "amount",
      title: "Amount Exceeds Limit",
      description: `Refund amount cannot exceed ₫${Math.round(Number(maxAllowedAmount)).toLocaleString("vi-VN")}.`,
    };
  }
  if (!String(finalReason || "").trim()) {
    return {
      valid: false,
      field: "reason",
      title: "Missing Return Reason",
      description:
        "Please select or specify a return reason before processing the refund.",
    };
  }
  return { valid: true };
}

export function normalizeRefundError(
  error,
  fallback = "Failed to process refund. Please try again.",
) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }
  if (error?.message) {
    return String(error.message);
  }
  return fallback;
}
