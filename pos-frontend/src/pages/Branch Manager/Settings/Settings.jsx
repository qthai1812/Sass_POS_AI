import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  Printer,
  Receipt,
  CreditCard,
  Save,
  Info,
  Percent,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { getBranchById } from "@/Redux Toolkit/features/branch/branchThunks";
import { useToast } from "@/components/ui/use-toast";
import BranchInfo from "./BranchInfo";
import {
  getBranchPrinterSettings,
  saveBranchPrinterSettings,
} from "@/utils/branchPrinterSettings";

const Settings = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);

  useEffect(() => {
    if (userProfile?.branchId && localStorage.getItem("jwt")) {
      dispatch(
        getBranchById({
          id: userProfile.branchId,
          jwt: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [dispatch, userProfile]);

  const [printerSettings, setPrinterSettings] = useState(() =>
    getBranchPrinterSettings(),
  );

  const handlePrinterSettingsChange = (field, value) => {
    setPrinterSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePrinterSettings = () => {
    const saved = saveBranchPrinterSettings(printerSettings);
    setPrinterSettings(saved);
    toast({
      title: "Printer Settings Saved",
      description: `Cấu hình in quầy (${saved.paperSize}) đã được áp dụng cho hóa đơn và phiếu trả hàng tại ${
        branch?.name || "chi nhánh này"
      }.`,
    });
  };

  const taxRate = store?.taxRate ?? 10;
  const paymentInfo = store?.paymentInfo || {};
  const acceptCash = paymentInfo.acceptCash !== false;
  const acceptMomo = paymentInfo.acceptMomo !== false;
  const acceptCard = paymentInfo.acceptCard !== false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Branch Settings</h1>
      </div>

      <Tabs defaultValue="branch-info">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="branch-info" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Branch Info
          </TabsTrigger>
          <TabsTrigger value="printer" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printer
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tax
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="discount" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Discount
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branch-info">
          <BranchInfo />
        </TabsContent>

        <TabsContent value="printer">
          <Card>
            <CardHeader>
              <CardTitle>POS Printer Settings</CardTitle>
              <CardDescription>
                Cấu hình máy in hóa đơn &amp; phiếu trả hàng trên trình duyệt
                quầy thu ngân này (áp dụng trực tiếp khi in Hóa đơn và Phiếu trả
                hàng).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="printer-name"
                      className="text-sm font-medium"
                    >
                      Printer Name
                    </label>
                    <Input
                      id="printer-name"
                      value={printerSettings.printerName}
                      onChange={(e) =>
                        handlePrinterSettingsChange(
                          "printerName",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="paper-size" className="text-sm font-medium">
                      Paper Size
                    </label>
                    <Select
                      value={printerSettings.paperSize}
                      onValueChange={(value) =>
                        handlePrinterSettingsChange("paperSize", value)
                      }
                    >
                      <SelectTrigger id="paper-size">
                        <SelectValue placeholder="Select paper size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">58mm (Thermal Roll)</SelectItem>
                        <SelectItem value="80mm">80mm (Thermal Roll)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="print-logo" className="text-sm font-medium">
                      Print Store Header on Receipt
                    </label>
                    <Switch
                      id="print-logo"
                      checked={printerSettings.printLogo}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange("printLogo", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="print-customer"
                      className="text-sm font-medium"
                    >
                      Print Customer Details
                    </label>
                    <Switch
                      id="print-customer"
                      checked={printerSettings.printCustomerDetails}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange(
                          "printCustomerDetails",
                          checked,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="print-tax" className="text-sm font-medium">
                      Print Itemized Tax
                    </label>
                    <Switch
                      id="print-tax"
                      checked={printerSettings.printItemizedTax}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange("printItemizedTax", checked)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="footer-text" className="text-sm font-medium">
                    Receipt Footer Text
                  </label>
                  <Input
                    id="footer-text"
                    value={printerSettings.footerText}
                    onChange={(e) =>
                      handlePrinterSettingsChange("footerText", e.target.value)
                    }
                    placeholder={
                      store?.receiptFooter || "Thank you for shopping with us!"
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" onClick={handleSavePrinterSettings}>
                  <Save className="h-4 w-4" />
                  Save Printer Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Store Tax Configuration (VAT)</CardTitle>
                  <CardDescription>
                    Mức thuế áp dụng cho toàn bộ đơn hàng tại chi nhánh.
                  </CardDescription>
                </div>
                <Badge variant="secondary">Cấu hình từ Cửa hàng</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Thuế VAT được quản lý tập trung bởi Chủ cửa hàng trong{" "}
                  <strong>Store Settings</strong> để đảm bảo đồng nhất giữa quầy
                  thu ngân POS và máy chủ.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border space-y-1">
                  <div className="text-xs text-muted-foreground uppercase">
                    Active VAT Rate
                  </div>
                  <div className="text-2xl font-bold">{taxRate}%</div>
                </div>
                <div className="p-4 rounded-lg border space-y-1">
                  <div className="text-xs text-muted-foreground uppercase">
                    Currency &amp; Timezone
                  </div>
                  <div className="text-base font-semibold">
                    {store?.currency || "VND"} &middot;{" "}
                    {store?.timezone || "Asia/Ho_Chi_Minh"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Accepted Payment Methods</CardTitle>
                  <CardDescription>
                    Trạng thái các phương thức thanh toán đang bật cho{" "}
                    {store?.brand || "cửa hàng"}.
                  </CardDescription>
                </div>
                <Badge variant="secondary">Cấu hình từ Cửa hàng</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Phương thức thanh toán và tài khoản nhận tiền (MoMo QR / Thẻ
                  Visa) được Chủ cửa hàng thiết lập tại{" "}
                  <strong>Store Settings &rarr; Payment Settings</strong>.
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">
                      Tiền mặt (Cash Payments)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Thu tiền mặt trực tiếp tại quầy POS
                    </div>
                  </div>
                  <Badge variant={acceptCash ? "default" : "secondary"}>
                    {acceptCash ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">
                      Chuyển khoản / MoMo QR
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {paymentInfo.momoPhone
                        ? `${paymentInfo.momoOwnerName || "MoMo"} (${paymentInfo.momoPhone})`
                        : "Chưa cấu hình SĐT MoMo"}
                    </div>
                  </div>
                  <Badge variant={acceptMomo ? "default" : "secondary"}>
                    {acceptMomo ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">
                      Thẻ Visa / Debit
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {paymentInfo.cardBankName || "Chưa cấu hình ngân hàng"}
                    </div>
                  </div>
                  <Badge variant={acceptCard ? "default" : "secondary"}>
                    {acceptCard ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discount">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Discount Policies</CardTitle>
                  <CardDescription>
                    Chính sách áp dụng mã giảm giá và chiết khấu thủ công tại
                    quầy POS.
                  </CardDescription>
                </div>
                <Badge variant="secondary">Cấu hình theo Hệ thống</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Mã khuyến mãi (Coupons) do Chủ cửa hàng phát hành trong mục{" "}
                  <strong>Coupons</strong>. Giới hạn giảm giá thủ công tại POS
                  được kiểm soát tự động theo vai trò nhân viên.
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">
                      Cashier Manual Discount Cap
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Thu ngân được giảm thủ công tối đa 10% giá trị đơn; vượt
                      ngưỡng cần mã khuyến mãi hoặc quyền quản lý.
                    </div>
                  </div>
                  <Badge variant="outline">10% Max</Badge>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">
                      Store Coupons &amp; Loyalty Points
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Áp dụng mã giảm giá hợp lệ của cửa hàng hoặc quy đổi điểm
                      khách hàng ngay trên màn hình POS.
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
