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

// Forgot Password (Bước 1 -> Bước 3)
export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async (email, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/forgot-password", { email });
      return res.data;
    } catch (err) {
      console.error("Forgot password error:", err);
      return rejectWithValue(
        err.response?.data?.message ||
          "Không thể gửi mã OTP đến email. Vui lòng kiểm tra kết nối hoặc thử lại sau.",
      );
    }
  },
);

// Verify OTP (Bước 4)
export const verifyResetOtp = createAsyncThunk(
  "auth/verifyResetOtp",
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/verify-reset-otp", { email, otp });
      return res.data; // { message, resetTicket, expiresInSeconds }
    } catch (err) {
      console.error("Verify OTP error:", err);
      return rejectWithValue(
        err.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
      );
    }
  },
);

// Reset Password (Bước 5)
export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ resetTicket, token, password, confirmPassword }, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/reset-password", {
        resetTicket: resetTicket || token,
        password,
        confirmPassword,
      });
      // Xóa toàn bộ JWT cũ trên trình duyệt hiện tại sau khi đặt lại mật khẩu thành công
      localStorage.removeItem("jwt");
      localStorage.removeItem("token");
      return res.data;
    } catch (err) {
      console.error("Reset password error:", err);
      return rejectWithValue(
        err.response?.data?.message || "Không thể cập nhật mật khẩu mới.",
      );
    }
  },
);
