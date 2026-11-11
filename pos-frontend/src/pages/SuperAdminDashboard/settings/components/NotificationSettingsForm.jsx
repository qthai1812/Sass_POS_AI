import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Clock } from "lucide-react";

const NotificationItem = ({ id, title, description, checked, onToggle }) => (
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

const NotificationSettingsForm = ({ notifications, onToggle }) => {
  const notificationItems = [
    {
      id: "newStoreRequests",
      title: "New Store Requests",
      description: "Get notified when new stores register",
    },
    {
      id: "storeApprovals",
      title: "Store Approvals",
      description: "Notifications for store approval actions",
    },
    {
      id: "commissionUpdates",
      title: "Commission Updates",
      description: "Alerts for commission rate changes",
    },
    {
      id: "systemAlerts",
      title: "System Alerts",
      description: "Important system notifications",
    },
    {
      id: "emailNotifications",
      title: "Email Notifications",
      description: "Receive notifications via email",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Sắp ra mắt (Chưa khả dụng)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          Hệ thống gửi thông báo tự động qua Email / Alert cho Super Admin đang
          trong quá trình tích hợp backend và hiện chưa khả dụng.
        </p>
        {notificationItems.map((item) => (
          <React.Fragment key={item.id}>
            <NotificationItem
              id={item.id}
              title={item.title}
              description={item.description}
              checked={notifications[item.id]}
              onToggle={() => onToggle(item.id)}
            />
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
};

export default NotificationSettingsForm;
