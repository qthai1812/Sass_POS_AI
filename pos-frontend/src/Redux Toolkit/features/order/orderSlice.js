import { createSlice } from '@reduxjs/toolkit';
import {
  createOrder,
  getOrderById,
  getOrdersByBranch,
  getOrdersByBranchPaged,
  getOrdersByCashier,
  getOrdersByCashierPaged,
  getTodayOrdersByBranch,
  deleteOrder,
  getOrdersByCustomer,
  getRecentOrdersByBranch,
  updateOrderStatus,
} from './orderThunks';
import { createRefund } from '../refund/refundThunks';
import { normalizePageResponse } from '@/utils/paginationUtils';

const createEmptyOrderPage = () => normalizePageResponse(null);

const initialState = {
  orders: [],
  pagedBranchOrders: createEmptyOrderPage(),
  pagedBranchLoading: false,
  pagedCashierOrders: createEmptyOrderPage(),
  pagedCashierLoading: false,
  todayOrders: [],
  customerOrders: [],
  selectedOrder: null,
  loading: false,
  error: null,
  recentOrders: [], // Added for recent orders
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    clearOrderState: (state) => {
      state.orders = [];
      state.pagedBranchOrders = createEmptyOrderPage();
      state.pagedCashierOrders = createEmptyOrderPage();
      state.todayOrders = [];
      state.customerOrders = [];
      state.selectedOrder = null;
      state.error = null;
    },
    clearCustomerOrders: (state) => {
      state.customerOrders = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => {
        state.loading = true;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.orders = [action.payload, ...(state.orders || [])];
          state.todayOrders = [action.payload, ...(state.todayOrders || [])];
          state.recentOrders = [action.payload, ...(state.recentOrders || [])].slice(0, 5);
        }
        state.selectedOrder = action.payload;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getOrderById.fulfilled, (state, action) => {
        const fetched = action.payload;
        state.selectedOrder = fetched;
        if (fetched?.id != null) {
          const replaceIfPresent = (list) =>
            (list || []).map((o) => (o.id === fetched.id ? fetched : o));
          state.orders = replaceIfPresent(state.orders);
          state.todayOrders = replaceIfPresent(state.todayOrders);
          state.customerOrders = replaceIfPresent(state.customerOrders);
          state.recentOrders = replaceIfPresent(state.recentOrders);
        }
      })

      .addCase(getOrdersByBranch.fulfilled, (state, action) => {
        state.orders = action.payload;
      })

      .addCase(getOrdersByBranchPaged.pending, (state) => {
        state.pagedBranchLoading = true;
        state.error = null;
      })
      .addCase(getOrdersByBranchPaged.fulfilled, (state, action) => {
        state.pagedBranchLoading = false;
        state.pagedBranchOrders = normalizePageResponse(action.payload);
      })
      .addCase(getOrdersByBranchPaged.rejected, (state, action) => {
        state.pagedBranchLoading = false;
        state.error = action.payload;
      })

      .addCase(getOrdersByCashier.fulfilled, (state, action) => {
        state.orders = action.payload;
        console.log("get order by cashier ", action.payload);
      })

      .addCase(getOrdersByCashierPaged.pending, (state) => {
        state.pagedCashierLoading = true;
        state.error = null;
      })
      .addCase(getOrdersByCashierPaged.fulfilled, (state, action) => {
        state.pagedCashierLoading = false;
        state.pagedCashierOrders = normalizePageResponse(action.payload);
      })
      .addCase(getOrdersByCashierPaged.rejected, (state, action) => {
        state.pagedCashierLoading = false;
        state.error = action.payload;
      })

      .addCase(getTodayOrdersByBranch.fulfilled, (state, action) => {
        state.todayOrders = action.payload;
      })

      .addCase(getOrdersByCustomer.fulfilled, (state, action) => {
        state.customerOrders = action.payload;
      })

      .addCase(getRecentOrdersByBranch.fulfilled, (state, action) => {
        state.recentOrders = action.payload;
      })

      .addCase(deleteOrder.fulfilled, (state, action) => {
        const deletedId = Number(action.payload);
        const keepNotDeleted = (o) => Number(o?.id) !== deletedId;

        state.orders = (state.orders || []).filter(keepNotDeleted);
        state.pagedBranchOrders.content = (state.pagedBranchOrders.content || []).filter(keepNotDeleted);
        state.pagedCashierOrders.content = (state.pagedCashierOrders.content || []).filter(keepNotDeleted);
        state.todayOrders = (state.todayOrders || []).filter(keepNotDeleted);
        state.customerOrders = (state.customerOrders || []).filter(keepNotDeleted);
        state.recentOrders = (state.recentOrders || []).filter(keepNotDeleted);

        if (state.selectedOrder && Number(state.selectedOrder.id) === deletedId) {
          state.selectedOrder = null;
        }
      })

      .addCase(updateOrderStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        const replaceOrder = (list) =>
          (list || []).map((o) => (o.id === updated.id ? updated : o));

        state.orders = replaceOrder(state.orders);
        state.pagedBranchOrders.content = replaceOrder(state.pagedBranchOrders.content);
        state.pagedCashierOrders.content = replaceOrder(state.pagedCashierOrders.content);
        state.todayOrders = replaceOrder(state.todayOrders);
        state.customerOrders = replaceOrder(state.customerOrders);
        state.recentOrders = replaceOrder(state.recentOrders);
        if (state.selectedOrder?.id === updated.id) {
          state.selectedOrder = updated;
        }
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createRefund.fulfilled, (state, action) => {
        const refund = action.payload;
        if (!refund?.orderId) return;
        const targetOrderId = Number(refund.orderId);
        const refundAmount = Number(refund.amount || 0);
        const markRefundedStatus = (order) => {
          if (!order || Number(order.id) !== targetOrderId) return order;
          const currentStatus = String(order.status || "").toUpperCase();
          const nextRefundedAmount =
            Math.round((Number(order.refundedAmount || 0) + refundAmount) * 100) / 100;
          if (currentStatus === "REFUNDED") {
            return { ...order, refundedAmount: nextRefundedAmount };
          }
          const total = Number(order.totalAmount || 0);
          const nextStatus =
            total > 0 && nextRefundedAmount >= total - 0.01
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED";
          return {
            ...order,
            status: nextStatus,
            refundedAmount: nextRefundedAmount,
          };
        };
        state.orders = (state.orders || []).map(markRefundedStatus);
        state.pagedBranchOrders.content = (state.pagedBranchOrders.content || []).map(markRefundedStatus);
        state.pagedCashierOrders.content = (state.pagedCashierOrders.content || []).map(markRefundedStatus);
        state.todayOrders = (state.todayOrders || []).map(markRefundedStatus);
        state.customerOrders = (state.customerOrders || []).map(markRefundedStatus);
        state.recentOrders = (state.recentOrders || []).map(markRefundedStatus);
        if (state.selectedOrder && Number(state.selectedOrder.id) === targetOrderId) {
          state.selectedOrder = markRefundedStatus(state.selectedOrder);
        }
      })

      .addMatcher(
        (action) => action.type.startsWith('order/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.error = action.payload;
        }
      );
  },
});

export const { clearOrderState, clearCustomerOrders } = orderSlice.actions;
export default orderSlice.reducer;
