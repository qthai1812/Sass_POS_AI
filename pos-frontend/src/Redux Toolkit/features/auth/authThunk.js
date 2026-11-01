import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../utils/api";

// ✅ Signup
export const signup = createAsyncThunk(
  "auth/signup",
  async (userData, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/signup", userData);
      const data = res.data;
      localStorage.setItem("jwt", data.jwt);
      return data;
    } catch (err) {
      console.error("Signup error:", err);
      return rejectWithValue(err.response?.data?.message || "Signup failed");
    }
  },
);

// ✅ Login
export const login = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      // Remove legacy browser-only access overrides; server DB loginAccess is authoritative
      localStorage.removeItem("pos_employee_access_overrides");
      localStorage.removeItem("pos_disabled_employees_v2");

      const res = await api.post("/auth/login", credentials);
      const data = res.data;
      if (data?.user?.loginAccess === false) {
        return rejectWithValue(
          "Login access for this account has been disabled by your manager.",
        );
      }

      // Check store status for all non-Super-Admin users
      if (data?.jwt && data?.user?.role && data.user.role !== "ROLE_ADMIN") {
        try {
          const authHeader = { Authorization: `Bearer ${data.jwt}` };
          let storeData = null;
          if (data.user.role === "ROLE_STORE_ADMIN") {
            const storeRes = await api.get("/api/stores/admin", {
              headers: authHeader,
            });
            storeData = storeRes.data;
          } else {
            try {
              const storeRes = await api.get("/api/stores/employee", {
                headers: authHeader,
              });
              storeData = storeRes.data;
            } catch {
              if (data.user.storeId) {
                const storeRes = await api.get(
                  `/api/stores/${data.user.storeId}`,
                  { headers: authHeader },
                );
                storeData = storeRes.data;
              }
            }
          }

          const storeStatus = storeData?.status?.toUpperCase();
          if (storeStatus === "BLOCKED") {
            localStorage.removeItem("jwt");
            localStorage.removeItem("token");
            return rejectWithValue(
              `Store "${storeData?.brand || "your store"}" has been BLOCKED by Super Admin. Access is suspended for all accounts in this store.`,
            );
          }
        } catch {
          // If user has no store yet (e.g. new Store Admin before onboarding), proceed normally
        }
      }

      localStorage.setItem("jwt", data.jwt);
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      return data;
    } catch (err) {
      console.error("Login error:", err);
      return rejectWithValue(err.response?.data?.message || "Login failed");
    }
  },
);

// ✅ Forgot Password
export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (email, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/forgot-password", { email });
      return res.data;
    } catch (err) {
      console.error("Forgot password error:", err);
      return rejectWithValue(
        err.response?.data?.message || "Failed to send reset email",
      );
    }
  },
);

// ✅ Reset Password
export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ token, password }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      return res.data;
    } catch (err) {
      console.error("Reset password error:", err);
      return rejectWithValue(
        err.response?.data?.message || "Failed to reset password",
      );
    }
  },
);
