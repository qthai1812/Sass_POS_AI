import { createSlice } from "@reduxjs/toolkit";
import {
  createInventory,
  updateInventory,
  deleteInventory,
  getInventoryById,
  getInventoryByBranch,
  getInventoryByBranchPaged,
  getInventorySummaryByBranch,
  getInventoryByProduct,
  transferInventory,
} from "./inventoryThunks";
import { createOrder } from "../order/orderThunks";
import { createRefund } from "../refund/refundThunks";
import { normalizePageResponse } from "@/utils/paginationUtils";

const createEmptyInventoryPage = () => normalizePageResponse(null);

const initialState = {
  inventories: [],
  pagedInventories: createEmptyInventoryPage(),
  pagedLoading: false,
  inventorySummary: {
    totalItems: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  },
  inventory: null,
  loading: false,
  error: null,
};

const inventorySlice = createSlice({
  name: "inventory",
  initialState,
  reducers: {
    clearInventoryState: (state) => {
      state.inventories = [];
      state.pagedInventories = createEmptyInventoryPage();
      state.inventorySummary = {
        totalItems: 0,
        totalQuantity: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
      state.inventory = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createInventory.pending, (state) => {
        state.loading = true;
      })
      .addCase(createInventory.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.inventories.findIndex(
          (inv) => inv.id === action.payload.id,
        );
        if (index !== -1) {
          state.inventories[index] = action.payload;
        } else {
          state.inventories.push(action.payload);
        }
      })
      .addCase(createInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updateInventory.fulfilled, (state, action) => {
        const index = state.inventories.findIndex(
          (inv) => inv.id === action.payload.id,
        );
        if (index !== -1) state.inventories[index] = action.payload;
        const pagedIdx = state.pagedInventories.content.findIndex(
          (inv) => inv.id === action.payload.id,
        );
        if (pagedIdx !== -1) {
          state.pagedInventories.content[pagedIdx] = action.payload;
        }
      })

      .addCase(deleteInventory.fulfilled, (state, action) => {
        state.inventories = state.inventories.filter(
          (inv) => inv.id !== action.payload,
        );
        state.pagedInventories.content = state.pagedInventories.content.filter(
          (inv) => inv.id !== action.payload,
        );
      })

      .addCase(getInventoryById.fulfilled, (state, action) => {
        state.inventory = action.payload;
      })

      .addCase(getInventoryByBranch.fulfilled, (state, action) => {
        state.inventories = action.payload;
      })

      .addCase(getInventoryByBranchPaged.pending, (state) => {
        state.pagedLoading = true;
        state.error = null;
      })
      .addCase(getInventoryByBranchPaged.fulfilled, (state, action) => {
        state.pagedLoading = false;
        state.pagedInventories = normalizePageResponse(action.payload);
      })
      .addCase(getInventoryByBranchPaged.rejected, (state, action) => {
        state.pagedLoading = false;
        state.error = action.payload;
      })

      .addCase(getInventorySummaryByBranch.fulfilled, (state, action) => {
        if (action.payload) {
          state.inventorySummary = {
            totalItems: Number(action.payload.totalItems || 0),
            totalQuantity: Number(action.payload.totalQuantity || 0),
            lowStockCount: Number(action.payload.lowStockCount || 0),
            outOfStockCount: Number(action.payload.outOfStockCount || 0),
          };
        }
      })

      .addCase(getInventoryByProduct.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.inventories = action.payload;
          state.inventory = action.payload[0] || null;
        } else {
          state.inventory = action.payload;
        }
      })

      .addCase(transferInventory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(transferInventory.fulfilled, (state, action) => {
        state.loading = false;
        const { productId, fromBranchId, quantity } = action.payload;
        const sourceInv = state.inventories.find(
          (inv) =>
            (inv.productId === productId || inv.product?.id === productId) &&
            (inv.branchId === fromBranchId || inv.branch?.id === fromBranchId),
        );
        if (sourceInv && typeof sourceInv.quantity === "number") {
          sourceInv.quantity = Math.max(0, sourceInv.quantity - quantity);
        }
      })
      .addCase(transferInventory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Tự động trừ tồn kho trên UI ngay sau khi tạo đơn hàng thành công
      .addCase(createOrder.fulfilled, (state, action) => {
        const order = action.payload;
        if (!order?.items || !Array.isArray(order.items)) return;
        order.items.forEach((orderItem) => {
          const pid = orderItem.productId ?? orderItem.product?.id;
          const qty = Number(orderItem.quantity || 0);
          if (!pid || qty <= 0) return;
          const inv = state.inventories.find(
            (i) => (i.productId ?? i.product?.id) === pid,
          );
          if (inv && typeof inv.quantity === "number") {
            inv.quantity = Math.max(0, inv.quantity - qty);
          }
        });
      })

      // Tự động cộng trả lại tồn kho trên UI ngay sau khi hoàn trả đơn hàng
      .addCase(createRefund.fulfilled, (state, action) => {
        const refund = action.payload;
        if (!refund?.items || !Array.isArray(refund.items)) return;
        refund.items.forEach((refundItem) => {
          const pid = refundItem.productId;
          const qty = Number(refundItem.quantity || 0);
          if (!pid || qty <= 0) return;
          const inv = state.inventories.find(
            (i) => (i.productId ?? i.product?.id) === pid,
          );
          if (inv && typeof inv.quantity === "number") {
            inv.quantity += qty;
          }
        });
      })

      .addMatcher(
        (action) =>
          action.type.startsWith("inventory/") &&
          action.type.endsWith("/rejected"),
        (state, action) => {
          state.error = action.payload;
        },
      );
  },
});

export const { clearInventoryState } = inventorySlice.actions;
export default inventorySlice.reducer;
