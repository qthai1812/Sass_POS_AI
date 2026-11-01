import React, { useState } from "react";
import { Routes, Route, Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import Login from "../pages/common/Auth/Login";
import ResetPassword from "../pages/common/Auth/ResetPassword";
import Onboarding from "../pages/onboarding/Onboarding";
import { forgotPassword } from "../Redux Toolkit/features/auth/authThunk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ForgotPasswordPage = () => {
  const dispatch = useDispatch();
  const { forgotPasswordLoading, forgotPasswordError, forgotPasswordSuccess } =
    useSelector((state) => state.auth);
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      dispatch(forgotPassword(email.trim()));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Forgot Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          {forgotPasswordSuccess ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-emerald-600 font-medium">
                Password reset link has been sent to <strong>{email}</strong>.
                Please check your inbox.
              </p>
              <Link to="/auth/login">
                <Button variant="outline" className="w-full mt-2">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your registered email address and we will send you a
                password reset link.
              </p>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {forgotPasswordError && (
                <p className="text-xs text-red-500">{forgotPasswordError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <div className="text-center text-sm">
                <Link to="/auth/login" className="text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
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
