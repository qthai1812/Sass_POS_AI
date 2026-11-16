/**
 * Shared pure utilities for Inter-Branch Inventory Transfer (Chủ chuỗi / Store Owner).
 * Keeps stock aggregation, validation, and post-transfer previews consistent between
 * the dedicated StoreInventoryTransfer workspace and the quick dialog in Alerts.
 */

export function buildStockLookupMap(inventories) {
  const map = {};
  if (!Array.isArray(inventories)) return map;
  inventories.forEach((inv) => {
    const pid = Number(inv?.productId ?? inv?.product?.id);
    if (!Number.isFinite(pid) || pid <= 0) return;
    map[pid] = (map[pid] || 0) + Number(inv?.quantity ?? 0);
  });
  return map;
}

export function resolveInventoryProductInfo(inv, productsList = [], categoriesList = []) {
  const safeProducts = Array.isArray(productsList) ? productsList : [];
  const safeCategories = Array.isArray(categoriesList) ? categoriesList : [];
  const pid = Number(inv?.productId ?? inv?.product?.id);

  const pObj =
    inv?.product ||
    safeProducts.find((p) => Number(p?.id) === pid) ||
    {};

  const categoryName =
    pObj?.category?.name ||
    (typeof pObj?.category === "string" ? pObj.category : null) ||
    inv?.category?.name ||
    (typeof inv?.category === "string" ? inv.category : null) ||
    safeCategories.find((c) => Number(c?.id) === Number(pObj?.categoryId))?.name ||
    "Chưa phân loại";

  return {
    id: inv?.id ?? pid,
    productId: Number.isFinite(pid) && pid > 0 ? pid : null,
    name: pObj?.name || inv?.productName || `Sản phẩm #${pid || ""}`,
    sku: pObj?.sku || inv?.sku || `SKU-${pid || ""}`,
    size: pObj?.size || inv?.size || "",
    color: pObj?.color || inv?.color || "",
    sellingPrice: Number(pObj?.sellingPrice ?? pObj?.price ?? inv?.sellingPrice ?? 0),
    category: categoryName,
    quantity: Number(inv?.quantity ?? 0),
    minStockLevel: Number(inv?.minStockLevel ?? 10),
    lastUpdate: inv?.lastUpdate || null,
  };
}

export function validateInventoryTransfer({
  branchCount = 0,
  fromBranchId,
  toBranchId,
  productId,
  quantity,
  availableSourceStock = 0,
  loadingSourceStock = false,
}) {
  if (Number(branchCount) < 2) {
    return {
      valid: false,
      errorTitle: "Chưa đủ chi nhánh",
      errorMessage: "Cần tối thiểu 2 chi nhánh trong chuỗi để thực hiện điều chuyển tồn kho.",
    };
  }
  if (!fromBranchId || !toBranchId || !productId) {
    return {
      valid: false,
      errorTitle: "Thiếu thông tin",
      errorMessage: "Vui lòng chọn đầy đủ chi nhánh nguồn, chi nhánh đích và sản phẩm.",
    };
  }
  if (String(fromBranchId) === String(toBranchId)) {
    return {
      valid: false,
      errorTitle: "Chi nhánh không hợp lệ",
      errorMessage: "Chi nhánh nguồn và chi nhánh đích phải khác nhau.",
    };
  }
  if (loadingSourceStock) {
    return {
      valid: false,
      errorTitle: "Đang tải tồn kho",
      errorMessage: "Hệ thống đang kiểm tra số lượng tồn khả dụng tại chi nhánh nguồn.",
    };
  }

  const numericQty = Number(quantity);
  if (!Number.isInteger(numericQty) || numericQty <= 0) {
    return {
      valid: false,
      errorTitle: "Số lượng không hợp lệ",
      errorMessage: "Số lượng điều chuyển phải là số nguyên lớn hơn 0.",
    };
  }

  const safeAvailable = Number(availableSourceStock ?? 0);
  if (numericQty > safeAvailable) {
    return {
      valid: false,
      errorTitle: "Không đủ tồn kho nguồn",
      errorMessage: `Chi nhánh nguồn chỉ còn ${safeAvailable} sản phẩm khả dụng.`,
    };
  }

  return { valid: true, errorTitle: null, errorMessage: null };
}

export function computeTransferPreview({
  availableSourceStock = 0,
  currentTargetStock = 0,
  quantity = 0,
}) {
  const source = Math.max(0, Number(availableSourceStock || 0));
  const target = Math.max(0, Number(currentTargetStock || 0));
  const numericQty = Number(quantity);
  const validQuantity =
    Number.isInteger(numericQty) && numericQty > 0 && numericQty <= source
      ? numericQty
      : 0;

  return {
    validQuantity,
    nextSourceStock: source - validQuantity,
    nextTargetStock: target + validQuantity,
  };
}
