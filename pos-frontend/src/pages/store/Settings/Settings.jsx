import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getStoreByAdmin,
  getStoreByEmployee,
  updateStore,
} from "@/Redux Toolkit/features/store/storeThunks";
import { toast } from "@/components/ui/use-toast";
import {
  SettingsHeader,
  SettingsNavigation,
  SettingsContent,
} from "./components";

const DEFAULT_NOTIFICATION_SETTINGS = {
  emailNotifications: false,
  smsNotifications: false,
  lowStockAlerts: false,
  salesReports: false,
  employeeActivity: false,
};

const DEFAULT_SECURITY_SETTINGS = {
  twoFactorAuth: false,
  passwordExpiry: "90",
  sessionTimeout: "30",
  ipRestriction: false,
};

export default function Settings() {
  const dispatch = useDispatch();
  const { store } = useSelector((state) => state.store);
  const { userProfile } = useSelector((state) => state.user);

  const [storeSettings, setStoreSettings] = useState({
    storeName: "My POS Store",
    storeEmail: "contact@myposstore.com",
    storePhone: "0901234567",
    storeAddress: "Hà Nội, Việt Nam",
    storeLogo: "/logo.png",
    storeDescription: "Hệ thống quản lý bán hàng đa chi nhánh.",
    currency: "VND",
    taxRate: "10",
    timezone: "Asia/Ho_Chi_Minh",
    dateFormat: "DD/MM/YYYY",
    receiptFooter: "Cảm ơn quý khách đã mua hàng!",
  });

  const [paymentSettings, setPaymentSettings] = useState({
    acceptCash: true,
    acceptMomo: true,
    acceptCard: true,
    momoPhone: "",
    momoOwnerName: "",
    momoQrImage: "",
    cardBankName: "",
    cardNumber: "",
    cardHolderName: "",
    cardExpiry: "",
  });

  const [activeSection, setActiveSection] = useState("store-settings");

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const isOwnerOrAdmin =
          userProfile?.role === "ROLE_STORE_OWNER" ||
          userProfile?.role === "ROLE_SUPER_ADMIN";
        await dispatch(
          isOwnerOrAdmin ? getStoreByAdmin() : getStoreByEmployee(),
        ).unwrap();
      } catch (err) {
        toast({
          title: "Error",
          description: err || "Failed to fetch store data",
          variant: "destructive",
        });
      }
    };

    fetchStoreData();
  }, [dispatch, userProfile?.role]);

  useEffect(() => {
    if (store) {
      setStoreSettings((prev) => ({
        ...prev,
        storeName: store.brand || "",
        storeEmail: store.contact?.email || "",
        storePhone: store.contact?.phone || "",
        storeAddress: store.contact?.address || "",
        storeDescription: store.description || "",
        currency: store.currency || "VND",
        taxRate:
          store.taxRate !== undefined && store.taxRate !== null
            ? String(store.taxRate)
            : "10",
        timezone: store.timezone || "Asia/Ho_Chi_Minh",
        dateFormat: store.dateFormat || "DD/MM/YYYY",
        receiptFooter: store.receiptFooter || "Cảm ơn quý khách đã mua hàng!",
      }));

      if (store.paymentInfo) {
        setPaymentSettings((prev) => ({
          ...prev,
          acceptCash: store.paymentInfo.acceptCash ?? true,
          acceptMomo: store.paymentInfo.acceptMomo ?? true,
          acceptCard: store.paymentInfo.acceptCard ?? true,
          momoPhone: store.paymentInfo.momoPhone || "",
          momoOwnerName: store.paymentInfo.momoOwnerName || "",
          momoQrImage: store.paymentInfo.momoQrImage || "",
          cardBankName: store.paymentInfo.cardBankName || "",
          cardNumber: store.paymentInfo.cardNumber || "",
          cardHolderName: store.paymentInfo.cardHolderName || "",
          cardExpiry: store.paymentInfo.cardExpiry || "",
        }));
      }
    }
  }, [store]);

  const handleStoreSettingsChange = (name, value) => {
    setStoreSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaymentSettingsChange = (name, value) => {
    setPaymentSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAll = async () => {
    if (!store?.id) {
      toast({
        title: "Không tìm thấy cửa hàng",
        description: "Chưa tải được thông tin cửa hàng để lưu lên máy chủ.",
        variant: "destructive",
      });
      return;
    }

    const parsedTax = parseFloat(storeSettings.taxRate);
    try {
      await dispatch(
        updateStore({
          id: store.id,
          storeData: {
            brand: storeSettings.storeName,
            description: storeSettings.storeDescription,
            storeType: store.storeType || "Retail Store",
            currency: storeSettings.currency || "VND",
            taxRate: Number.isFinite(parsedTax) ? Math.max(0, parsedTax) : 10,
            timezone: storeSettings.timezone || "Asia/Ho_Chi_Minh",
            dateFormat: storeSettings.dateFormat || "DD/MM/YYYY",
            receiptFooter: storeSettings.receiptFooter || "",
            contact: {
              email: storeSettings.storeEmail,
              phone: storeSettings.storePhone,
              address: storeSettings.storeAddress,
            },
            paymentInfo: {
              acceptCash: paymentSettings.acceptCash,
              acceptMomo: paymentSettings.acceptMomo,
              acceptCard: paymentSettings.acceptCard,
              momoPhone: paymentSettings.momoPhone?.trim() || "",
              momoOwnerName: paymentSettings.momoOwnerName?.trim() || "",
              momoQrImage: paymentSettings.momoQrImage?.trim() || "",
              cardBankName: paymentSettings.cardBankName?.trim() || "",
              cardNumber: paymentSettings.cardNumber?.trim() || "",
              cardHolderName: paymentSettings.cardHolderName?.trim() || "",
              cardExpiry: paymentSettings.cardExpiry?.trim() || "",
            },
          },
        }),
      ).unwrap();

      toast({
        title: "Đã lưu cấu hình thành công!",
        description:
          "Thông tin cửa hàng, thuế VAT và tài khoản nhận tiền (MoMo QR / Thẻ Visa) đã được đồng bộ cho mọi quầy thu ngân.",
      });
    } catch (err) {
      toast({
        title: "Lỗi lưu cấu hình cửa hàng",
        description: err || "Không thể cập nhật thông tin lên máy chủ.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <SettingsNavigation
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />
        </div>

        <div className="md:col-span-2">
          <SettingsContent
            storeSettings={storeSettings}
            notificationSettings={DEFAULT_NOTIFICATION_SETTINGS}
            securitySettings={DEFAULT_SECURITY_SETTINGS}
            paymentSettings={paymentSettings}
            onStoreSettingsChange={handleStoreSettingsChange}
            onNotificationSettingsChange={() => {}}
            onSecuritySettingsChange={() => {}}
            onPaymentSettingsChange={handlePaymentSettingsChange}
            onSaveAll={handleSaveAll}
          />
        </div>
      </div>
    </div>
  );
}
