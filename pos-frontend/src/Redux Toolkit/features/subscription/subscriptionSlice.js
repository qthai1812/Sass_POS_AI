import { createSlice } from '@reduxjs/toolkit';
import {
  subscribeToPlan,
  upgradeSubscription,
  activateSubscription,
  cancelSubscription,
  updatePaymentStatus,
  getStoreSubscriptions,
  getAllSubscriptions,
  getExpiringSubscriptions,
  countSubscriptionsByStatus,
  getMyEntitlements
} from './subscriptionThunks';

const initialState = {
  subscriptions: [],
  selectedSubscription: null,
  expiringSubscriptions: [],
  countByStatus: null,
  entitlements: null,
  entitlementsUserId: null,
  entitlementsLoading: false,
  loading: false,
  error: null,
};

const resolveSubStoreId = (sub) => sub?.storeId ?? sub?.store?.id ?? null;

const upsertStoreSubscription = (subscriptions = [], newSub) => {
  if (!newSub) return subscriptions;
  const targetStoreId = resolveSubStoreId(newSub);
  const isBecomingActive =
    newSub.status === 'ACTIVE' || newSub.status === 'TRIAL';

  let found = false;
  const next = subscriptions.map((sub) => {
    if (sub.id === newSub.id) {
      found = true;
      return newSub;
    }
    if (
      isBecomingActive &&
      targetStoreId != null &&
      resolveSubStoreId(sub) === targetStoreId &&
      (sub.status === 'ACTIVE' || sub.status === 'TRIAL')
    ) {
      return { ...sub, status: 'CANCELLED' };
    }
    return sub;
  });

  if (!found) {
    next.unshift(newSub);
  }
  return next;
};

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    clearSubscriptionState: (state) => {
      state.subscriptions = [];
      state.selectedSubscription = null;
      state.expiringSubscriptions = [];
      state.countByStatus = null;
      state.entitlements = null;
      state.entitlementsUserId = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(subscribeToPlan.pending, (state) => {
        state.loading = true;
      })
      .addCase(subscribeToPlan.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = upsertStoreSubscription(state.subscriptions, action.payload);
      })
      .addCase(subscribeToPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(upgradeSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = upsertStoreSubscription(state.subscriptions, action.payload);
      })
      .addCase(upgradeSubscription.pending, (state) => {
        state.loading = true;
      })
      .addCase(upgradeSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(activateSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = upsertStoreSubscription(state.subscriptions, action.payload);
      })
      .addCase(activateSubscription.pending, (state) => {
        state.loading = true;
      })
      .addCase(activateSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(cancelSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = state.subscriptions.map(sub => sub.id === action.payload.id ? action.payload : sub);
      })
      .addCase(cancelSubscription.pending, (state) => {
        state.loading = true;
      })
      .addCase(cancelSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(updatePaymentStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = upsertStoreSubscription(state.subscriptions, action.payload);
      })
      .addCase(updatePaymentStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(updatePaymentStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getStoreSubscriptions.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStoreSubscriptions.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = action.payload;
      })
      .addCase(getStoreSubscriptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getAllSubscriptions.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllSubscriptions.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = action.payload;
      })
      .addCase(getAllSubscriptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getExpiringSubscriptions.fulfilled, (state, action) => {
        state.expiringSubscriptions = action.payload;
      })
      .addCase(getExpiringSubscriptions.rejected, (state, action) => {
        state.error = action.payload;
      })

      .addCase(countSubscriptionsByStatus.fulfilled, (state, action) => {
        state.countByStatus = action.payload;
      })
      .addCase(countSubscriptionsByStatus.rejected, (state, action) => {
        state.error = action.payload;
      })

      .addCase(getMyEntitlements.pending, (state) => {
        state.entitlementsLoading = true;
      })
      .addCase(getMyEntitlements.fulfilled, (state, action) => {
        state.entitlementsLoading = false;
        state.entitlements = action.payload.data;
        state.entitlementsUserId = action.payload.userId;
      })
      .addCase(getMyEntitlements.rejected, (state) => {
        state.entitlementsLoading = false;
      })

      .addMatcher(
        (action) => action.type.startsWith('subscription/') && action.type.endsWith('/rejected')
          && !action.type.includes('getMyEntitlements'),
        (state, action) => {
          state.error = action.payload;
        }
      );
  },
});

export const { clearSubscriptionState } = subscriptionSlice.actions;
export default subscriptionSlice.reducer;
