import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock } from "lucide-react";
import ToggleSwitch from "./ToggleSwitch";

const NotificationSettings = ({ settings }) => {
  const notificationOptions = [
    {
      name: "emailNotifications",
      title: "Email Notifications",
      description: "Receive notifications via email",
    },
    {
      name: "smsNotifications",
      title: "SMS Notifications",
      description: "Receive notifications via SMS",
    },
    {
      name: "lowStockAlerts",
      title: "Low Stock Alerts",
      description: "Get notified when inventory is low",
    },
    {
      name: "salesReports",
      title: "Sales Reports",
      description: "Receive periodic sales reports",
    },
    {
      name: "employeeActivity",
      title: "Employee Activity",
      description: "Get notified about employee activities",
    },
  ];

  return (
    <Card id="notification-settings">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5 text-emerald-500" />
              Notification Settings
            </CardTitle>
            <CardDescription className="mt-1">
              Configure how you receive automated alerts and notifications
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Sắp ra mắt (Chưa khả dụng)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          Kênh gửi thông báo tự động qua Email / SMS hiện đang trong giai đoạn
          phát triển backend và chưa khả dụng.
        </p>
        <div className="space-y-4 opacity-70">
          {notificationOptions.map((option) => (
            <div key={option.name} className="flex items-center justify-between">
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
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
