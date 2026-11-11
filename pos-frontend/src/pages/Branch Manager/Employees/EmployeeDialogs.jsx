import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Copy, Check } from "lucide-react";

export const ResetPasswordDialog = ({
  isResetPasswordDialogOpen,
  setIsResetPasswordDialogOpen,
  selectedEmployee,
  handleResetPassword,
  generatedPassword = "",
  isResetting = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable on non-HTTPS origins
    }
  };

  return (
    selectedEmployee && (
      <Dialog
        open={isResetPasswordDialogOpen}
        onOpenChange={setIsResetPasswordDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Cashier Password</DialogTitle>
          </DialogHeader>
          {generatedPassword ? (
            <div className="py-4 space-y-3">
              <p className="text-sm">
                Mật khẩu tạm thời cho thu ngân{" "}
                <strong>
                  {selectedEmployee.fullName || selectedEmployee.email}
                </strong>{" "}
                đã được cập nhật:
              </p>
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
                <code className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300 select-all">
                  {generatedPassword}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Phiên đăng nhập cũ của thu ngân đã bị thu hồi. Hãy gửi mật khẩu này cho nhân viên và nhắc đổi mật khẩu ngay sau khi đăng nhập.
              </p>
            </div>
          ) : (
            <div className="py-4">
              <p>
                Are you sure you want to reset the password for{" "}
                <strong>
                  {selectedEmployee.fullName || selectedEmployee.name}
                </strong>
                ?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                A temporary password will be generated and applied to their account.
              </p>
            </div>
          )}
          <DialogFooter>
            {generatedPassword ? (
              <Button onClick={() => setIsResetPasswordDialogOpen(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsResetPasswordDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleResetPassword} disabled={isResetting}>
                  {isResetting ? "Resetting..." : "Reset Password"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  );
};

export const PerformanceDialog = ({
  isPerformanceDialogOpen,
  setIsPerformanceDialogOpen,
  selectedEmployee,
}) => {
  const { orders = [] } = useSelector((state) => state.order || {});
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const employeeOrders = (orders || []).filter((o) => {
    const matchesEmployee =
      o.cashierId === selectedEmployee?.id ||
      o.cashier?.id === selectedEmployee?.id;
    if (!matchesEmployee) return false;

    const statusUpper = String(o.status || "COMPLETED").toUpperCase();
    if (statusUpper !== "COMPLETED" && statusUpper !== "PARTIALLY_REFUNDED")
      return false;

    if (o.createdAt) {
      const orderDate = new Date(o.createdAt);
      if (!isNaN(orderDate.getTime()) && orderDate < thirtyDaysAgo) {
        return false;
      }
    }
    return true;
  });

  const ordersProcessed = employeeOrders.length;
  const totalSales = employeeOrders.reduce(
    (sum, o) => sum + (Number(o.totalAmount) || 0),
    0,
  );
  const avgOrderValue =
    ordersProcessed > 0 ? Math.round(totalSales / ordersProcessed) : 0;

  const handleExportEmployeeReport = () => {
    if (!selectedEmployee) return;
    const empName = (
      selectedEmployee.fullName ||
      selectedEmployee.name ||
      "Employee"
    ).replace(/"/g, '""');
    const csvRows = [
      "Employee ID,Full Name,Email,Role,Metric,Value",
      `${selectedEmployee.id},"${empName}","${selectedEmployee.email || ""}","${selectedEmployee.role || ""}","Orders Processed (30d)",${ordersProcessed}`,
      `${selectedEmployee.id},"${empName}","${selectedEmployee.email || ""}","${selectedEmployee.role || ""}","Total Sales (30d)",${totalSales}`,
      `${selectedEmployee.id},"${empName}","${selectedEmployee.email || ""}","${selectedEmployee.role || ""}","Avg. Order Value (30d)",${avgOrderValue}`,
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvRows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `performance_${selectedEmployee.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    selectedEmployee && (
      <Dialog
        open={isPerformanceDialogOpen}
        onOpenChange={setIsPerformanceDialogOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Performance Summary -{" "}
              {selectedEmployee.fullName || selectedEmployee.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Orders Processed
                  </h3>
                  <p className="text-3xl font-bold mt-2">{ordersProcessed}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last 30 days (completed)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Total Sales
                  </h3>
                  <p className="text-3xl font-bold mt-2">
                    ₫{totalSales.toLocaleString("vi-VN")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Avg. Order Value
                  </h3>
                  <p className="text-3xl font-bold mt-2">
                    ₫{avgOrderValue.toLocaleString("vi-VN")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPerformanceDialogOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handleExportEmployeeReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  );
};
