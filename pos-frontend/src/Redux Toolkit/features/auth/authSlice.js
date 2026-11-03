import { createSlice } from "@reduxjs/toolkit";
import {
  login,
  signup,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "./authThunk";
import { logout as userLogout } from "../user/userThunks";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
    forgotPasswordLoading: false,
    forgotPasswordError: null,
    forgotPasswordSuccess: false,
    forgotPasswordMessage: null,
    verifyOtpLoading: false,
    verifyOtpError: null,
    verifyOtpSuccess: false,
    resetTicket: null,
    resetPasswordLoading: false,
    resetPasswordError: null,
    resetPasswordSuccess: false,
    resetPasswordMessage: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem("jwt");
      localStorage.removeItem("token");
    },
    clearForgotPasswordState: (state) => {
      state.forgotPasswordLoading = false;
      state.forgotPasswordError = null;
      state.forgotPasswordSuccess = false;
      state.forgotPasswordMessage = null;
      state.verifyOtpLoading = false;
      state.verifyOtpError = null;
      state.verifyOtpSuccess = false;
      state.resetTicket = null;
    },
    clearResetPasswordState: (state) => {
      state.resetPasswordLoading = false;
      state.resetPasswordError = null;
      state.resetPasswordSuccess = false;
      state.resetPasswordMessage = null;
      state.resetTicket = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Bước 1 -> 3: Forgot Password
      .addCase(forgotPassword.pending, (state) => {
        state.forgotPasswordLoading = true;
        state.forgotPasswordError = null;
        state.forgotPasswordSuccess = false;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordSuccess = true;
        state.forgotPasswordMessage =
          action.payload?.message ||
          "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được gửi";
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = action.payload;
        state.forgotPasswordSuccess = false;
      })
      // Bước 4: Verify OTP
      .addCase(verifyResetOtp.pending, (state) => {
        state.verifyOtpLoading = true;
        state.verifyOtpError = null;
        state.verifyOtpSuccess = false;
      })
      .addCase(verifyResetOtp.fulfilled, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpSuccess = true;
        state.resetTicket = action.payload?.resetTicket || null;
      })
      .addCase(verifyResetOtp.rejected, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpError = action.payload;
        state.verifyOtpSuccess = false;
      })
      // Bước 5: Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.resetPasswordLoading = true;
        state.resetPasswordError = null;
        state.resetPasswordSuccess = false;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.resetPasswordLoading = false;
        state.resetPasswordSuccess = true;
        state.resetPasswordMessage =
          action.payload?.message || "Đổi mật khẩu thành công!";
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.resetPasswordLoading = false;
        state.resetPasswordError = action.payload;
        state.resetPasswordSuccess = false;
      })
      .addCase(userLogout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { logout, clearForgotPasswordState, clearResetPasswordState } =
  authSlice.actions;
export default authSlice.reducer;
