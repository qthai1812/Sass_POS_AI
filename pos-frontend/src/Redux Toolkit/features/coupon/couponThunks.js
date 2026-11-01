import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "@/utils/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem('jwt');
  if (!token) throw new Error('No JWT token found');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const createCoupon = createAsyncThunk("coupon/create", async (dto, { rejectWithValue }) => {
  try {
    const res = await api.post("/api/coupons", dto, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || "Failed to create coupon");
  }
});

export const updateCoupon = createAsyncThunk("coupon/update", async ({ id, dto }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/api/coupons/${id}`, dto, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || "Failed to update coupon");
  }
});

export const deleteCoupon = createAsyncThunk("coupon/delete", async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/api/coupons/${id}`, { headers: getAuthHeaders() });
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || "Failed to delete coupon");
  }
});

export const getCouponsByStore = createAsyncThunk("coupon/getByStore", async (storeId, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/coupons/store/${storeId}`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || "Failed to fetch coupons");
  }
});

export const applyCoupon = createAsyncThunk("coupon/apply", async ({ code, storeId }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/api/coupons/apply?code=${code}&storeId=${storeId}`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || "Invalid or expired coupon");
  }
});
