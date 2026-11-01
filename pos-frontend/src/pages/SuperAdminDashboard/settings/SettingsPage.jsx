import React from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Shield,
  Bell,
  Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";
import ProfileSettingsForm from "./components/ProfileSettingsForm";
import SecuritySettingsForm from "./components/SecuritySettingsForm";
import NotificationSettingsForm from "./components/NotificationSettingsForm";
import SystemSettingsForm from "./components/SystemSettingsForm";
import PlatformPaymentSettingsForm from "./components/PlatformPaymentSettingsForm";
import { useSettingsState } from "./components/useSettingsState";

const SettingsTabTrigger = ({ value, children }) => (
  <TabsTrigger value={value} className="flex items-center gap-2">
    {children}
  </TabsTrigger>
);

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "payment";

  const {
    profileData,
    loading,
    passwordData,
    showPasswords,
    notifications,
    systemSettings,
    paymentConfig,
    savingPayment,
    handleProfileUpdate,
    handlePasswordChange,
    handleNotificationToggle,
    handleSystemSettingToggle,
    handleProfileFieldChange,
    handlePasswordFieldChange,
    handleShowPasswordToggle,
    handlePaymentConfigChange,
    handlePaymentConfigSave,
  } = useSettingsState();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Cài đặt Hệ thống & Nhận Thanh toán (POS Admin)
        </h2>
        <p className="text-muted-foreground">
          Quản lý tài khoản quản trị, cấu hình nhận tiền gói cước (MoMo QR / Thẻ
          Visa) và thiết lập hệ thống
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <SettingsTabTrigger value="payment">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Nhận thanh toán (MoMo / Visa)
          </SettingsTabTrigger>
          <SettingsTabTrigger value="profile">
            <User className="w-4 h-4" />
            Hồ sơ (Profile)
          </SettingsTabTrigger>
          <SettingsTabTrigger value="security">
            <Shield className="w-4 h-4" />
            Bảo mật (Security)
          </SettingsTabTrigger>
          <SettingsTabTrigger value="notifications">
            <Bell className="w-4 h-4" />
            Thông báo
          </SettingsTabTrigger>
          <SettingsTabTrigger value="system">
            <SettingsIcon className="w-4 h-4" />
            Hệ thống
          </SettingsTabTrigger>
        </TabsList>

        <TabsContent value="payment">
          <PlatformPaymentSettingsForm
            paymentConfig={paymentConfig}
            onChange={handlePaymentConfigChange}
            onSave={handlePaymentConfigSave}
            saving={savingPayment}
          />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileSettingsForm
            profileData={profileData}
            onUpdate={handleProfileUpdate}
            onFieldChange={handleProfileFieldChange}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettingsForm
            passwordData={passwordData}
            showPasswords={showPasswords}
            onPasswordChange={handlePasswordFieldChange}
            onShowPasswordToggle={handleShowPasswordToggle}
            onUpdate={handlePasswordChange}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettingsForm
            notifications={notifications}
            onToggle={handleNotificationToggle}
          />
        </TabsContent>

        <TabsContent value="system">
          <SystemSettingsForm
            systemSettings={systemSettings}
            onToggle={handleSystemSettingToggle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
