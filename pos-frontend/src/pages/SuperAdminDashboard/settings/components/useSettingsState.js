import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/components/ui/use-toast";
import { getUserProfile } from "@/Redux Toolkit/features/user/userThunks";
import api from "@/utils/api";

export const useSettingsState = () => {
  const dispatch = useDispatch();
  const { userProfile, loading } = useSelector((state) => state.user);
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (token && !userProfile) {
      dispatch(getUserProfile(token));
    }
  }, [dispatch, userProfile]);

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        fullName: userProfile.fullName || "",
        email: userProfile.email || "",
        phone: userProfile.phone || userProfile.mobile || "",
      });
    }
  }, [userProfile]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [notifications, setNotifications] = useState({
    newStoreRequests: true,
    storeApprovals: true,
    commissionUpdates: false,
    systemAlerts: true,
    emailNotifications: true,
  });

  const [systemSettings, setSystemSettings] = useState({
    autoApproveStores: false,
    requireDocumentVerification: true,
    commissionAutoCalculation: true,
    maintenanceMode: false,
  });

  const [paymentConfig, setPaymentConfig] = useState({
    acceptMomo: true,
    acceptCard: true,
    momoPhone: "0901234567",
    momoOwnerName: "POS PRO ENTERPRISE SAAS",
    momoQrImage: "",
    cardBankName: "Vietcombank - Visa",
    cardNumber: "4221567890123456",
    cardHolderName: "POS PRO ENTERPRISE SAAS",
    cardExpiry: "12/29",
  });
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    const fetchPlatformPaymentConfig = async () => {
      try {
        const res = await api.get("/api/payment-gateway/platform-config");
        if (res.data) {
          setPaymentConfig({
            acceptMomo: res.data.acceptMomo ?? true,
            acceptCard: res.data.acceptCard ?? true,
            momoPhone: res.data.momoPhone || "",
            momoOwnerName: res.data.momoOwnerName || "",
            momoQrImage: res.data.momoQrImage || "",
            cardBankName: res.data.cardBankName || "",
            cardNumber: res.data.cardNumber || "",
            cardHolderName: res.data.cardHolderName || "",
            cardExpiry: res.data.cardExpiry || "",
          });
        }
      } catch (err) {
        console.error("Failed to load platform payment config:", err);
      }
    };
    fetchPlatformPaymentConfig();
  }, []);

  const handlePaymentConfigChange = (field, value) => {
    setPaymentConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handlePaymentConfigSave = async () => {
    setSavingPayment(true);
    try {
      const res = await api.put(
        "/api/payment-gateway/platform-config",
        paymentConfig,
      );
      if (res.data) {
        setPaymentConfig((prev) => ({ ...prev, ...res.data }));
      }
      toast({
        title: "Đã lưu cấu hình nhận tiền POS Admin",
        description:
          "Thông tin MoMo QR & Thẻ Visa/Ghi nợ nhận tiền gói cước đã được đồng bộ.",
      });
    } catch (err) {
      toast({
        title: "Lỗi khi lưu cấu hình",
        description:
          err.response?.data?.message ||
          "Không thể lưu thông tin nhận tiền POS Admin.",
        variant: "destructive",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      await api.put("/api/users/profile", {
        fullName: profileData.fullName,
        phone: profileData.phone,
      });
      const token = localStorage.getItem("jwt");
      if (token) {
        dispatch(getUserProfile(token));
      }
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.put("/api/users/change-password", {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully.",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      toast({
        title: "Password Change Failed",
        description: err.response?.data?.message || "Could not change password",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const savedNotif = localStorage.getItem("superadmin_notifications");
    if (savedNotif) {
      try {
        setNotifications(JSON.parse(savedNotif));
      } catch {
        // ignore invalid stored JSON
      }
    }
    const savedSys = localStorage.getItem("superadmin_system_settings");
    if (savedSys) {
      try {
        setSystemSettings(JSON.parse(savedSys));
      } catch {
        // ignore invalid stored JSON
      }
    }
  }, []);

  const handleNotificationToggle = (key) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("superadmin_notifications", JSON.stringify(updated));
      toast({
        title: "Notification Preference Saved",
        description: `Setting "${key}" has been ${updated[key] ? "enabled" : "disabled"}.`,
      });
      return updated;
    });
  };

  const handleSystemSettingToggle = (key) => {
    setSystemSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(
        "superadmin_system_settings",
        JSON.stringify(updated),
      );
      toast({
        title: "System Setting Updated",
        description: `Setting "${key}" has been ${updated[key] ? "enabled" : "disabled"}.`,
      });
      return updated;
    });
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordFieldChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handleShowPasswordToggle = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return {
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
  };
};
