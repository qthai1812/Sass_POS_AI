import { createSlice } from "@reduxjs/toolkit";
import {
  createStore,
  getStoreById,
  getAllStores,
  getAllStoresPaged,
  getStoreSummary,
  updateStore,
  deleteStore,
  getStoreByAdmin,
  getStoreByEmployee,
  getStoreEmployees,
  addEmployee,
  moderateStore,
} from "./storeThunks";
import { normalizePageResponse } from "@/utils/paginationUtils";

const createEmptyStorePage = () => normalizePageResponse(null);

const initialState = {
  store: null,
  stores: [],
  pagedStores: createEmptyStorePage(),
  pagedLoading: false,
  storeSummary: {
    totalStores: 0,
    activeStores: 0,
    pendingStores: 0,
    blockedStores: 0,
    rejectedStores: 0,
    averageCommissionRate: 0,
    totalEarnings: 0,
  },
  employees: [],
  loading: false,
  error: null,
};

const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    clearStoreState: (state) => {
      state.store = null;
      state.pagedStores = createEmptyStorePage();
      state.error = null;
      state.employees = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createStore.pending, (state) => {
        state.loading = true;
      })
      .addCase(createStore.fulfilled, (state, action) => {
        state.loading = false;
        state.store = action.payload;
      })
      .addCase(createStore.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getStoreById.fulfilled, (state, action) => {
        state.store = action.payload;
      })
      .addCase(getAllStores.fulfilled, (state, action) => {
        state.stores = action.payload;
      })
      .addCase(getAllStoresPaged.pending, (state) => {
        state.pagedLoading = true;
        state.error = null;
      })
      .addCase(getAllStoresPaged.fulfilled, (state, action) => {
        state.pagedLoading = false;
        state.pagedStores = normalizePageResponse(action.payload);
      })
      .addCase(getAllStoresPaged.rejected, (state, action) => {
        state.pagedLoading = false;
        state.error = action.payload;
      })
      .addCase(getStoreSummary.fulfilled, (state, action) => {
        if (action.payload) {
          state.storeSummary = {
            totalStores: Number(action.payload.totalStores || 0),
            activeStores: Number(action.payload.activeStores || 0),
            pendingStores: Number(action.payload.pendingStores || 0),
            blockedStores: Number(action.payload.blockedStores || 0),
            rejectedStores: Number(action.payload.rejectedStores || 0),
            averageCommissionRate: Number(action.payload.averageCommissionRate || 0),
            totalEarnings: Number(action.payload.totalEarnings || 0),
          };
        }
      })
      .addCase(updateStore.fulfilled, (state, action) => {
        state.store = action.payload;
        state.stores = state.stores.map((store) =>
          store.id === action.payload.id ? action.payload : store,
        );
        state.pagedStores.content = state.pagedStores.content.map((store) =>
          store.id === action.payload.id ? action.payload : store,
        );
      })
      .addCase(deleteStore.fulfilled, (state, action) => {
        const deletedId = action.payload?.id;
        if (deletedId) {
          state.stores = state.stores.filter((store) => store.id !== deletedId);
          state.pagedStores.content = state.pagedStores.content.filter(
            (store) => store.id !== deletedId,
          );
          if (state.store?.id === deletedId) {
            state.store = null;
          }
        } else {
          state.store = null;
        }
      })
      .addCase(getStoreByAdmin.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStoreByAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.store = action.payload || null;
      })
      .addCase(getStoreByAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getStoreByEmployee.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStoreByEmployee.fulfilled, (state, action) => {
        state.loading = false;
        state.store = action.payload || null;
      })
      .addCase(getStoreByEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getStoreEmployees.fulfilled, (state, action) => {
        state.employees = action.payload;
      })
      .addCase(addEmployee.fulfilled, (state, action) => {
        state.employees.push(action.payload);
      })
      .addCase(moderateStore.fulfilled, (state, action) => {
        const updated = action.payload;
        state.stores = state.stores.map((store) =>
          store.id === updated.id ? updated : store,
        );
        state.pagedStores.content = state.pagedStores.content.map((store) =>
          store.id === updated.id ? updated : store,
        );
      })
      .addMatcher(
        (action) =>
          action.type.startsWith("store/") && action.type.endsWith("/rejected"),
        (state, action) => {
          state.error = action.payload;
        },
      );
  },
});

export const { clearStoreState } = storeSlice.actions;
export default storeSlice.reducer;
