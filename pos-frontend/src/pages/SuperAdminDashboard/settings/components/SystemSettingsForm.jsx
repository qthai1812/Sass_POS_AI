import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Clock } from "lucide-react";

const SystemSettingItem = ({ id, title, description, checked, onToggle }) => (
  <>
    <div className="flex items-center justify-between opacity-70">
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onToggle}
        disabled
      />
    </div>
    <Separator />
  </>
);

const SystemSettingsForm = ({ systemSettings, onToggle }) => {
  const systemSettingItems = [
    {
      id: "autoApproveStores",
      title: "Auto-approve Stores",
      description: "Automatically approve new store registrations",
    },
    {
      id: "requireDocumentVerification",
      title: "Require Document Verification",
      description: "Mandatory document verification for store approval",
    },
    {
      id: "commissionAutoCalculation",
      title: "Auto Commission Calculation",
      description: "Automatically calculate commissions",
    },
    {
      id: "maintenanceMode",
      title: "Maintenance Mode",
      description: "Enable maintenance mode for system updates",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Settings
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Sắp ra mắt (Chưa khả dụng)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          Các công tắc tự động duyệt cửa hàng, tính hoa hồng và Maintenance Mode
          hiện chưa được kích hoạt trên backend (mọi cửa hàng mới hiện cần duyệt
          thủ công tại Pending Requests).
        </p>
        {systemSettingItems.map((item) => (
          <React.Fragment key={item.id}>
            <SystemSettingItem
              id={item.id}
              title={item.title}
              description={item.description}
              checked={systemSettings[item.id]}
              onToggle={() => onToggle(item.id)}
            />
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
};

export default SystemSettingsForm;
