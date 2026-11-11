import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, KeyRound, Loader2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import api from "@/utils/api";
import ToggleSwitch from "./ToggleSwitch";

const SecuritySettings = ({ settings }) => {
  const { toast } = useToast();
  const [pwd, setPwd] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPwd, setChangingPwd] = useState(false);

  const securityOptions = [
    {
      name: "twoFactorAuth",
      title: "Two-Factor Authentication",
      description: "Add an extra layer of security",
    },
    {
      name: "ipRestriction",
      title: "IP Restriction",
      description: "Limit access to specific IP addresses",
    },
  ];

  const handlePasswordSubmit = async (e) => {
    e?.preventDefault();
    if (!pwd.currentPassword || !pwd.newPassword) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ mật khẩu",
        variant: "destructive",
      });
      return;
    }
    if (pwd.newPassword.length < 6) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu mới phải từ 6 ký tự trở lên",
        variant: "destructive",
      });
      return;
    }
    if (pwd.newPassword !== pwd.confirmPassword) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu xác nhận không khớp",
        variant: "destructive",
      });
      return;
    }
    setChangingPwd(true);
    try {
      await api.put("/api/users/change-password", {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      });
      toast({ title: "Thành công", description: "Đã đổi mật khẩu thành công!" });
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast({
        title: "Đổi mật khẩu thất bại",
        description:
          err.response?.data?.message || "Mật khẩu hiện tại không đúng",
        variant: "destructive",
      });
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <Card id="security-settings">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="mr-2 h-5 w-5 text-emerald-500" />
          Security Settings
        </CardTitle>
        <CardDescription>
          Configure security options and manage your account credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-medium text-sm text-foreground">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            Đổi mật khẩu tài khoản
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium">
                Mật khẩu hiện tại *
              </label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="••••••••"
                value={pwd.currentPassword}
                onChange={(e) =>
                  setPwd({ ...pwd, currentPassword: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                Mật khẩu mới (≥ 6 ký tự) *
              </label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={pwd.newPassword}
                onChange={(e) =>
                  setPwd({ ...pwd, newPassword: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Xác nhận mật khẩu mới *
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={pwd.confirmPassword}
                onChange={(e) =>
                  setPwd({ ...pwd, confirmPassword: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handlePasswordSubmit}
              disabled={changingPwd}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {changingPwd ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang đổi mật khẩu...
                </>
              ) : (
                "Cập nhật mật khẩu"
              )}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">
              Chính sách bảo mật nâng cao
            </h4>
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              Sắp ra mắt (Chưa khả dụng)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
            Xác thực 2 bước (2FA), giới hạn IP và thời hạn phiên/mật khẩu chưa
            được kích hoạt trên máy chủ.
          </p>

          <div className="space-y-4 opacity-70">
            {securityOptions.map((option) => (
              <div
                key={option.name}
                className="flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-medium">{option.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <ToggleSwitch
                  name={option.name}
                  checked={settings[option.name]}
                  onChange={() => {}}
                  disabled
                />
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="passwordExpiry"
                  className="text-sm font-medium"
                >
                  Password Expiry (days)
                </label>
                <Input
                  id="passwordExpiry"
                  name="passwordExpiry"
                  type="number"
                  value={settings.passwordExpiry}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="sessionTimeout"
                  className="text-sm font-medium"
                >
                  Session Timeout (minutes)
                </label>
                <Input
                  id="sessionTimeout"
                  name="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecuritySettings;
