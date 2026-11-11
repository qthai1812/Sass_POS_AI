import { createSlice } from '@reduxjs/toolkit';
import {
  createOrder,
  getOrderById,
  getOrdersByBranch,
  getOrdersByCashier,
  getTodayOrdersByBranch,
  deleteOrder,
  getOrdersByCustomer,
  getRecentOrdersByBranch,
  updateOrderStatus,
} from './orderThunks';
import { createRefund } from '../refund/refundThunks';

const initialState = {
  orders: [],
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

      .addCase(getOrdersByCashier.fulfilled, (state, action) => {
        state.orders = action.payload;
        console.log("get order by cashier ", action.payload);
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
          list.map((o) => (o.id === updated.id ? updated : o));

        state.orders = replaceOrder(state.orders);
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
        const markRefundedStatus = (order) => {
          if (!order || Number(order.id) !== targetOrderId) return order;
          const currentStatus = String(order.status || "").toUpperCase();
          if (currentStatus === "REFUNDED") return order;
          const total = Number(order.totalAmount || 0);
          const nextStatus =
            total > 0 && Number(refund.amount || 0) >= total - 0.01
              ? "REFUNDED"
              : "PARTIALLY_REFUNDED";
          return { ...order, status: nextStatus };
        };
        state.orders = (state.orders || []).map(markRefundedStatus);
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
