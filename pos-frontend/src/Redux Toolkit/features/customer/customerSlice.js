import { createSlice } from "@reduxjs/toolkit";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  getAllCustomers,
  searchCustomers,
  getCustomersPaged,
  getCustomerSummary,
} from "./customerThunks";
import { createOrder } from "../order/orderThunks";
import { normalizePageResponse } from "@/utils/paginationUtils";

const createEmptyPage = () => normalizePageResponse(null);

const initialState = {
  customers: [],
  pagedCustomers: createEmptyPage(),
  pagedLoading: false,
  customerSummary: {
    totalCustomers: 0,
    goldAndDiamondCount: 0,
    totalLoyaltyPoints: 0,
  },
  summaryLoading: false,
  selectedCustomer: null,
  loading: false,
  error: null,
};

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    clearCustomerState: (state) => {
      state.customers = [];
      state.pagedCustomers = createEmptyPage();
      state.customerSummary = {
        totalCustomers: 0,
        goldAndDiamondCount: 0,
        totalLoyaltyPoints: 0,
      };
      state.selectedCustomer = null;
      state.error = null;
    },
    clearSelectedCustomer: (state) => {
      state.selectedCustomer = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Customer
      .addCase(createCustomer.pending, (state) => {
        state.loading = true;
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.customers.unshift(action.payload);
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Customer
      .addCase(updateCustomer.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.customers.findIndex(
          (customer) => customer.id === action.payload.id,
        );
        if (index !== -1) {
          state.customers[index] = action.payload;
        }
        const pagedIdx = state.pagedCustomers.content.findIndex(
          (customer) => customer.id === action.payload.id,
        );
        if (pagedIdx !== -1) {
          state.pagedCustomers.content[pagedIdx] = action.payload;
        }
        if (
          state.selectedCustomer &&
          state.selectedCustomer.id === action.payload.id
        ) {
          state.selectedCustomer = action.payload;
        }
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Customer
      .addCase(deleteCustomer.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = state.customers.filter(
          (customer) => customer.id !== action.payload,
        );
        const beforeLen = state.pagedCustomers.content.length;
        state.pagedCustomers.content = state.pagedCustomers.content.filter(
          (customer) => customer.id !== action.payload,
        );
        if (state.pagedCustomers.content.length < beforeLen) {
          state.pagedCustomers.totalElements = Math.max(
            0,
            state.pagedCustomers.totalElements - 1,
          );
        }
        if (
          state.selectedCustomer &&
          state.selectedCustomer.id === action.payload
        ) {
          state.selectedCustomer = null;
        }
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Customer by ID
      .addCase(getCustomerById.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCustomerById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCustomer = action.payload;
      })
      .addCase(getCustomerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get All Customers
      .addCase(getAllCustomers.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload;
      })
      .addCase(getAllCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Search Customers
      .addCase(searchCustomers.pending, (state) => {
        state.loading = true;
      })
      .addCase(searchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload;
      })
      .addCase(searchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Get Customers Paged
      .addCase(getCustomersPaged.pending, (state) => {
        state.pagedLoading = true;
      })
      .addCase(getCustomersPaged.fulfilled, (state, action) => {
        state.pagedLoading = false;
        state.pagedCustomers = normalizePageResponse(action.payload);
      })
      .addCase(getCustomersPaged.rejected, (state, action) => {
        state.pagedLoading = false;
        state.error = action.payload;
      })

      // Get Customer Summary
      .addCase(getCustomerSummary.pending, (state) => {
        state.summaryLoading = true;
      })
      .addCase(getCustomerSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        if (action.payload) {
          state.customerSummary = {
            totalCustomers: Number(action.payload.totalCustomers || 0),
            goldAndDiamondCount: Number(action.payload.goldAndDiamondCount || 0),
            totalLoyaltyPoints: Number(action.payload.totalLoyaltyPoints || 0),
          };
        }
      })
      .addCase(getCustomerSummary.rejected, (state) => {
        state.summaryLoading = false;
      })

      // Tự động đồng bộ loyaltyPoints của khách hàng sau khi tạo Order thành công
      .addCase(createOrder.fulfilled, (state, action) => {
        const updatedCustomer = action.payload?.customer;
        if (updatedCustomer && updatedCustomer.id) {
          const index = state.customers.findIndex(
            (c) => c.id === updatedCustomer.id,
          );
          if (index !== -1) {
            state.customers[index] = updatedCustomer;
          }
          const pagedIdx = state.pagedCustomers.content.findIndex(
            (c) => c.id === updatedCustomer.id,
          );
          if (pagedIdx !== -1) {
            state.pagedCustomers.content[pagedIdx] = updatedCustomer;
          }
          if (
            state.selectedCustomer &&
            state.selectedCustomer.id === updatedCustomer.id
          ) {
            state.selectedCustomer = updatedCustomer;
          }
        }
      })

      // Generic error handling for all customer actions
      .addMatcher(
        (action) =>
          action.type.startsWith("customer/") &&
          action.type.endsWith("/rejected"),
        (state, action) => {
          state.error = action.payload;
        },
      );
  },
});

export const { clearCustomerState, clearSelectedCustomer } =
  customerSlice.actions;
export default customerSlice.reducer;
