import { createSlice } from '@reduxjs/toolkit';
import { createCoupon, updateCoupon, deleteCoupon, getCouponsByStore, applyCoupon } from './couponThunks';

const initialState = {
  coupons: [],
  appliedCoupon: null,
  loading: false,
  error: null,
};

const couponSlice = createSlice({
  name: 'coupon',
  initialState,
  reducers: {
    clearCouponError: (state) => {
      state.error = null;
    },
    removeAppliedCoupon: (state) => {
      state.appliedCoupon = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Coupons
      .addCase(getCouponsByStore.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(getCouponsByStore.fulfilled, (state, action) => {
        state.loading = false;
        state.coupons = action.payload;
      })
      .addCase(getCouponsByStore.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create
      .addCase(createCoupon.fulfilled, (state, action) => {
        state.coupons.push(action.payload);
      })
      // Update
      .addCase(updateCoupon.fulfilled, (state, action) => {
        const index = state.coupons.findIndex(c => c.id === action.payload.id);
        if (index !== -1) state.coupons[index] = action.payload;
      })
      // Delete
      .addCase(deleteCoupon.fulfilled, (state, action) => {
        state.coupons = state.coupons.filter(c => c.id !== action.payload);
      })
      // Apply
      .addCase(applyCoupon.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(applyCoupon.fulfilled, (state, action) => {
        state.loading = false;
        state.appliedCoupon = action.payload;
      })
      .addCase(applyCoupon.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearCouponError, removeAppliedCoupon } = couponSlice.actions;
export default couponSlice.reducer;
