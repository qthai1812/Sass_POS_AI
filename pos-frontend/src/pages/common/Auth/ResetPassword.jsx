import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { resetPassword } from "../../../Redux Toolkit/features/auth/authThunk";
import { clearResetPasswordState } from "../../../Redux Toolkit/features/auth/authSlice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Hỗ trợ nhận cả param "resetTicket" hoặc "token" (tương thích ngược) từ URL hoặc Redux state
  const tokenFromUrl = searchParams.get("resetTicket") || searchParams.get("token") || "";

  const {
    resetPasswordLoading,
    resetPasswordError,
    resetPasswordSuccess,
    resetPasswordMessage,
    resetTicket: stateResetTicket,
  } = useSelector((state) => state.auth);

  const activeTicket = tokenFromUrl || stateResetTicket;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    return () => {
      dispatch(clearResetPasswordState());
    };
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!activeTicket) {
      setLocalError("Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại từ bước quên mật khẩu.");
      return;
    }

    if (!password || password.length < 6) {
      setLocalError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không khớp với mật khẩu mới.");
      return;
    }

    // Gửi request đặt lại mật khẩu kèm resetTicket lên backend
    const res = await dispatch(
      resetPassword({
        resetTicket: activeTicket,
        password,
        confirmPassword,
      })
    );

    if (res.meta.requestStatus === "fulfilled") {
      setTimeout(() => {
        navigate("/auth/login");
      }, 2500);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Đặt lại mật khẩu
          </CardTitle>
          <p className="text-xs text-center text-muted-foreground">
            Nhập mật khẩu mới cho tài khoản POS Pro của bạn
          </p>
        </CardHeader>
        <CardContent>
          {resetPasswordSuccess ? (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-emerald-600">
                {resetPasswordMessage ||
                  "Đổi mật khẩu thành công! Toàn bộ phiên đăng nhập cũ đã được vô hiệu hóa. Đang chuyển hướng về trang đăng nhập..."}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/auth/login")}
              >
                Đến trang Đăng nhập
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!activeTicket && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Không tìm thấy mã xác thực phiên (Reset Ticket). Vui lòng thực hiện lại quy trình Quên mật khẩu.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium">Mật khẩu mới</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!activeTicket}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Xác nhận mật khẩu mới</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={!activeTicket}
                />
              </div>

              {(localError || resetPasswordError) && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{localError || resetPasswordError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordLoading || !activeTicket}
              >
                {resetPasswordLoading ? "Đang cập nhật mật khẩu..." : "Xác nhận đổi mật khẩu"}
              </Button>

              <div className="text-center text-sm pt-2">
                <Link to="/auth/login" className="text-primary hover:underline">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
