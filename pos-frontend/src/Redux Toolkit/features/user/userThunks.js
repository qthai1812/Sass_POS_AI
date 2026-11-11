import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "@/utils/api";
import { clearStoreState } from "../store/storeSlice";

const buildAuthConfig = (token) => {
  const effectiveToken = token || localStorage.getItem("jwt");
  return effectiveToken
    ? { headers: { Authorization: `Bearer ${effectiveToken}` } }
    : {};
};

// Get user profile from JWT
export const getUserProfile = createAsyncThunk(
  "user/getProfile",
  async (token, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/users/profile", buildAuthConfig(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch profile",
      );
    }
  },
);

// Update own profile (fullName, phone)
export const updateUserProfile = createAsyncThunk(
  "user/updateProfile",
  async ({ fullName, phone, token }, { rejectWithValue }) => {
    try {
      const res = await api.put(
        "/api/users/profile",
        { fullName, phone },
        buildAuthConfig(token),
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Không thể cập nhật thông tin cá nhân",
      );
    }
  },
);

// Change own password
export const changeUserPassword = createAsyncThunk(
  "user/changePassword",
  async ({ currentPassword, newPassword, token }, { rejectWithValue }) => {
    try {
      const res = await api.put(
        "/api/users/change-password",
        { currentPassword, newPassword },
        buildAuthConfig(token),
      );
      if (res.data?.jwt) {
        localStorage.setItem("jwt", res.data.jwt);
      }
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Đổi mật khẩu thất bại",
      );
    }
  },
);

// Get all customers (Khớp với CustomerController: /api/customers & UserController: /api/users/customer)
export const getCustomers = createAsyncThunk(
  "user/getCustomers",
  async (token, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/customers", buildAuthConfig(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch customers",
      );
    }
  },
);

// Get all cashiers (Khớp với UserController: /api/users/cashier, giới hạn theo Store của người dùng)
export const getCashiers = createAsyncThunk(
  "user/getCashiers",
  async (token, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/users/cashier", buildAuthConfig(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch cashiers",
      );
    }
  },
);

// Get all users (Đã thêm tiền tố /api để khớp với UserController)
export const getAllUsers = createAsyncThunk(
  "user/getAll",
  async (token, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/users/list", buildAuthConfig(token));
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch users",
      );
    }
  },
);

// Get user by ID (Đã thêm tiền tố /api để khớp với UserController)
export const getUserById = createAsyncThunk(
  "user/getById",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/api/users/${userId}`, buildAuthConfig());
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "User not found");
    }
  },
);

// Logout user
export const logout = createAsyncThunk(
  "user/logout",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      localStorage.removeItem("jwt");
      localStorage.removeItem("token");
      dispatch(clearStoreState());
      return "Logged out successfully";
    } catch (err) {
      return rejectWithValue(err.message || "Failed to logout");
    }
  },
);
