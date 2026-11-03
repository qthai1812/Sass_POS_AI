import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Link, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import Login from "../pages/common/Auth/Login";
import ResetPassword from "../pages/common/Auth/ResetPassword";
import Onboarding from "../pages/onboarding/Onboarding";
import {
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../Redux Toolkit/features/auth/authThunk";
import {
  clearForgotPasswordState,
  clearResetPasswordState,
} from "../Redux Toolkit/features/auth/authSlice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Mail,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

const ForgotPasswordPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    forgotPasswordLoading,
    forgotPasswordError,
    forgotPasswordMessage,
    verifyOtpLoading,
    verifyOtpError,
    resetTicket,
    resetPasswordLoading,
    resetPasswordError,
    resetPasswordSuccess,
    resetPasswordMessage,
  } = useSelector((state) => state.auth);

  // step: 1 = Nhập Email & Get OTP, 2 = Nhập OTP 6 số, 3 = Nhập mật khẩu mới
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Khóa đồng bộ (Synchronous Lock) chặn bấm nhiều lần khi Sender chưa phản hồi
  const requestInFlightRef = useRef(false);
  const [isLockedWaitingSender, setIsLockedWaitingSender] = useState(false);

  // Đồng hồ đếm ngược 5 phút (300 giây) cho OTP và 60 giây chờ gửi lại
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    return () => {
      dispatch(clearForgotPasswordState());
      dispatch(clearResetPasswordState());
    };
  }, [dispatch]);

  useEffect(() => {
    if (otpCountdown <= 0 && resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown, resendCooldown]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // BƯỚC 1 -> 3: Bấm Get OTP -> Khóa nút tối màu chờ Sender phản hồi -> Chuyển sang màn nhập OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();

    // Chặn tuyệt đối nếu đang chờ Sender phản hồi
    if (
      requestInFlightRef.current ||
      isLockedWaitingSender ||
      forgotPasswordLoading
    ) {
      return;
    }

    if (!email.trim()) {
      setLocalError("Vui lòng nhập email hoặc tên đăng nhập của bạn.");
      return;
    }

    setLocalError(null);
    requestInFlightRef.current = true;
    setIsLockedWaitingSender(true);

    try {
      const res = await dispatch(forgotPassword(email.trim()));
      if (res.meta.requestStatus === "fulfilled") {
        setStep(2);
        setOtp("");
        setOtpCountdown(300); // 5 phút hiệu lực OTP
        setResendCooldown(60); // Khóa gửi lại trong 60 giây
      }
    } finally {
      requestInFlightRef.current = false;
      setIsLockedWaitingSender(false);
    }
  };

  // BƯỚC 4: Xác thực OTP 6 chữ số với Backend -> Nhận Reset Ticket chuyển sang Bước 5
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (requestInFlightRef.current || verifyOtpLoading) return;
    setLocalError(null);

    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setLocalError("Vui lòng nhập đủ mã OTP gồm 6 chữ số.");
      return;
    }

    requestInFlightRef.current = true;
    try {
      const res = await dispatch(
        verifyResetOtp({ email: email.trim(), otp: cleanOtp }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setStep(3);
      }
    } finally {
      requestInFlightRef.current = false;
    }
  };

  // BƯỚC 5: Đặt mật khẩu mới (nhập 2 lần khớp nhau)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (requestInFlightRef.current || resetPasswordLoading) return;
    setLocalError(null);

    if (newPassword.length < 6) {
      setLocalError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Mật khẩu nhập lại không khớp.");
      return;
    }

    requestInFlightRef.current = true;
    try {
      const res = await dispatch(
        resetPassword({
          resetTicket,
          password: newPassword,
          confirmPassword,
        }),
      );
      if (res.meta.requestStatus === "fulfilled") {
        setTimeout(() => {
          navigate("/auth/login");
        }, 2000);
      }
    } finally {
      requestInFlightRef.current = false;
    }
  };

  const isSenderBusy = isLockedWaitingSender || forgotPasswordLoading;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {step === 1 && "Quên mật khẩu"}
            {step === 2 && "Nhập mã xác thực OTP"}
            {step === 3 && "Thiết lập mật khẩu mới"}
          </CardTitle>
          <p className="text-xs text-center text-muted-foreground">
            {step === 1 && "Nhập email tài khoản để nhận mã OTP 6 chữ số"}
            {step === 2 && "Kiểm tra hộp thư đến và nhập mã OTP có hiệu lực trong 5 phút"}
            {step === 3 && "Nhập mật khẩu mới 2 lần để hoàn tất khôi phục"}
          </p>
        </CardHeader>

        <CardContent>
          {/* ================= BƯỚC 1: NHẬP EMAIL & GET OTP ================= */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Nhập email của bạn..."
                  className="pl-9"
                  value={email}
                  disabled={isSenderBusy}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {(localError || forgotPasswordError) && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block">Không thể gửi OTP:</span>
                    <span className="break-words">
                      {localError || forgotPasswordError}
                    </span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSenderBusy || !email.trim()}
                className={`w-full transition-all ${
                  isSenderBusy
                    ? "bg-slate-700 text-slate-300 dark:bg-slate-800 dark:text-slate-400 opacity-60 cursor-not-allowed pointer-events-none"
                    : ""
                }`}
              >
                {isSenderBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang chờ Sender gửi OTP...
                  </span>
                ) : (
                  "Get OTP (Nhận mã OTP)"
                )}
              </Button>

              <div className="text-center text-sm">
                <Link
                  to="/auth/login"
                  className={`text-primary hover:underline ${
                    isSenderBusy ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}

          {/* ================= BƯỚC 2 -> 4: NHẬP & XÁC THỰC OTP ================= */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Thông báo hệ thống
                </div>
                <p>
                  {forgotPasswordMessage ||
                    "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được gửi"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Mã OTP (6 chữ số)</span>
                  <span className="flex items-center gap-1 text-amber-600 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    Hết hạn sau: {formatTimer(otpCountdown)}
                  </span>
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Nhập 6 chữ số OTP..."
                  className="text-center tracking-[0.5em] font-mono text-lg font-bold"
                  value={otp}
                  disabled={verifyOtpLoading || isSenderBusy}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              {(localError || verifyOtpError || forgotPasswordError) && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">
                    {localError || verifyOtpError || forgotPasswordError}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={
                  verifyOtpLoading ||
                  isSenderBusy ||
                  otpCountdown === 0 ||
                  otp.length !== 6
                }
                className={`w-full transition-all ${
                  verifyOtpLoading || isSenderBusy
                    ? "bg-slate-700 text-slate-300 opacity-60 cursor-not-allowed pointer-events-none"
                    : ""
                }`}
              >
                {verifyOtpLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang kiểm tra OTP...
                  </span>
                ) : (
                  "Xác nhận mã OTP"
                )}
              </Button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  disabled={isSenderBusy || verifyOtpLoading}
                  onClick={() => {
                    dispatch(clearForgotPasswordState());
                    setLocalError(null);
                    setStep(1);
                  }}
                  className="text-muted-foreground hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Đổi địa chỉ email
                </button>

                <button
                  type="button"
                  disabled={
                    resendCooldown > 0 || isSenderBusy || verifyOtpLoading
                  }
                  onClick={handleRequestOtp}
                  className={`px-2.5 py-1 rounded font-medium inline-flex items-center gap-1 transition-all ${
                    resendCooldown > 0 || isSenderBusy || verifyOtpLoading
                      ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 opacity-60 cursor-not-allowed pointer-events-none"
                      : "text-primary hover:underline"
                  }`}
                >
                  {isSenderBusy ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Đang chờ Sender...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Get OTP lại (${resendCooldown}s)`
                  ) : (
                    "Get OTP lại"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= BƯỚC 5: CẬP NHẬT MẬT KHẨU MỚI ================= */}
          {step === 3 && (
            <>
              {resetPasswordSuccess ? (
                <div className="space-y-4 text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-sm font-medium text-emerald-600">
                    {resetPasswordMessage ||
                      "Đổi mật khẩu thành công! Đang chuyển hướng về trang đăng nhập..."}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/auth/login")}
                  >
                    Về trang đăng nhập ngay
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Mật khẩu mới</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        className="pl-9 pr-9"
                        value={newPassword}
                        disabled={resetPasswordLoading}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-3 text-muted-foreground"
                      >
                        {showPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Xác nhận mật khẩu mới
                    </label>
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      disabled={resetPasswordLoading}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  {(localError || resetPasswordError) && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="break-words">
                        {localError || resetPasswordError}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={resetPasswordLoading}
                    className={`w-full transition-all ${
                      resetPasswordLoading
                        ? "bg-slate-700 text-slate-300 opacity-60 cursor-not-allowed pointer-events-none"
                        : ""
                    }`}
                  >
                    {resetPasswordLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang mã hóa BCrypt & lưu mật khẩu...
                      </span>
                    ) : (
                      "Cập nhật mật khẩu mới"
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AuthRoutes = () => {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="onboarding" element={<Onboarding />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPassword />} />
    </Routes>
  );
};

export default AuthRoutes;
