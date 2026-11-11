import { createSlice } from '@reduxjs/toolkit';
import {
  createRefund,
  getAllRefunds,
  getRefundsByCashier,
  getRefundsByBranch,
  getRefundsByOrder,
  getRefundsByShift,
  getRefundsByCashierAndDateRange,
  getRefundById,
  deleteRefund
} from './refundThunks';

const initialState = {
  refunds: [],
  refundsByCashier: [],
  refundsByBranch: [],
  refundsByOrder: [],
  refundsByOrderId: null,
  refundsByShift: [],
  refundsByDateRange: [],
  selectedRefund: null,
  loading: false,
  error: null,
};

const upsertRefund = (list, item) => {
  if (!item) return list || [];
  const safeList = Array.isArray(list) ? list : [];
  if (item.id == null) return [...safeList, item];
  const exists = safeList.some((r) => Number(r?.id) === Number(item.id));
  if (exists) {
    return safeList.map((r) => (Number(r?.id) === Number(item.id) ? item : r));
  }
  return [...safeList, item];
};

const refundSlice = createSlice({
  name: 'refund',
  initialState,
  reducers: {
    clearRefundState: (state) => {
      state.refunds = [];
      state.refundsByCashier = [];
      state.refundsByBranch = [];
      state.refundsByOrder = [];
      state.refundsByOrderId = null;
      state.refundsByShift = [];
      state.refundsByDateRange = [];
      state.selectedRefund = null;
      state.error = null;
    },
    clearSelectedRefund: (state) => {
      state.selectedRefund = null;
    },
    clearRefundsByCashier: (state) => {
      state.refundsByCashier = [];
    },
    clearRefundsByBranch: (state) => {
      state.refundsByBranch = [];
    },
    clearRefundsByOrder: (state) => {
      state.refundsByOrder = [];
      state.refundsByOrderId = null;
    },
    clearRefundsByShift: (state) => {
      state.refundsByShift = [];
    },
    clearRefundsByDateRange: (state) => {
      state.refundsByDateRange = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Refund
      .addCase(createRefund.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createRefund.fulfilled, (state, action) => {
        state.loading = false;
        const created = action.payload;
        state.refunds = upsertRefund(state.refunds, created);
        state.refundsByCashier = upsertRefund(state.refundsByCashier, created);
        state.refundsByBranch = upsertRefund(state.refundsByBranch, created);
        if (
          created?.orderId != null &&
          (state.refundsByOrderId == null ||
            Number(state.refundsByOrderId) === Number(created.orderId))
        ) {
          state.refundsByOrderId = created.orderId;
          state.refundsByOrder = upsertRefund(state.refundsByOrder, created);
        }
        if (created?.shiftReportId) {
          state.refundsByShift = upsertRefund(state.refundsByShift, created);
        }
      })
      .addCase(createRefund.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get All Refunds
      .addCase(getAllRefunds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllRefunds.fulfilled, (state, action) => {
        state.loading = false;
        state.refunds = action.payload;
      })
      .addCase(getAllRefunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Refunds by Cashier
      .addCase(getRefundsByCashier.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRefundsByCashier.fulfilled, (state, action) => {
        state.loading = false;
        state.refundsByCashier = action.payload;
      })
      .addCase(getRefundsByCashier.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Refunds by Branch
      .addCase(getRefundsByBranch.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRefundsByBranch.fulfilled, (state, action) => {
        state.loading = false;
        state.refundsByBranch = action.payload;
      })
      .addCase(getRefundsByBranch.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Refunds by Order
      .addCase(getRefundsByOrder.pending, (state) => {
        state.error = null;
      })
      .addCase(getRefundsByOrder.fulfilled, (state, action) => {
        state.refundsByOrderId = action.payload?.orderId ?? null;
        state.refundsByOrder = action.payload?.refunds || [];
      })
      .addCase(getRefundsByOrder.rejected, (state, action) => {
        state.error = action.payload;
      })

      // Get Refunds by Shift
      .addCase(getRefundsByShift.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRefundsByShift.fulfilled, (state, action) => {
        state.loading = false;
        state.refundsByShift = action.payload;
      })
      .addCase(getRefundsByShift.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Refunds by Cashier and Date Range
      .addCase(getRefundsByCashierAndDateRange.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRefundsByCashierAndDateRange.fulfilled, (state, action) => {
        state.loading = false;
        state.refundsByDateRange = action.payload;
      })
      .addCase(getRefundsByCashierAndDateRange.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Refund by ID
      .addCase(getRefundById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRefundById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedRefund = action.payload;
      })
      .addCase(getRefundById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Refund
      .addCase(deleteRefund.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteRefund.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = Number(action.payload);
        const keepNotDeleted = (refund) => Number(refund?.id) !== deletedId;
        state.refunds = (state.refunds || []).filter(keepNotDeleted);
        state.refundsByCashier = (state.refundsByCashier || []).filter(keepNotDeleted);
        state.refundsByBranch = (state.refundsByBranch || []).filter(keepNotDeleted);
        state.refundsByOrder = (state.refundsByOrder || []).filter(keepNotDeleted);
        state.refundsByShift = (state.refundsByShift || []).filter(keepNotDeleted);
        state.refundsByDateRange = (state.refundsByDateRange || []).filter(keepNotDeleted);
        
        if (state.selectedRefund && Number(state.selectedRefund.id) === deletedId) {
          state.selectedRefund = null;
        }
      })
      .addCase(deleteRefund.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Generic error handling for all refund actions
      .addMatcher(
        (action) => action.type.startsWith('refund/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.error = action.payload;
        }
      );
  },
});

export const { 
  clearRefundState, 
  clearSelectedRefund, 
  clearRefundsByCashier, 
  clearRefundsByBranch, 
  clearRefundsByOrder,
  clearRefundsByShift, 
  clearRefundsByDateRange 
} = refundSlice.actions;

export default refundSlice.reducer; 