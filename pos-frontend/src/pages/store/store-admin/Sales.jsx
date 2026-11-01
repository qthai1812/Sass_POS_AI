import React, { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CreditCard, DollarSign, User, Store } from "lucide-react";
import {
  getStoreOverview,
  getDailySales,
  getSalesByPaymentMethod,
} from "@/Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";
import { useToast } from "@/components/ui/use-toast";
import AddSaleDialog from "./AddSaleDialog";

export default function Sales() {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const { storeOverview, dailySales, salesByPaymentMethod, loading } =
    useSelector((state) => state.storeAnalytics);

  const fetchSalesData = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      await Promise.all([
        dispatch(getStoreOverview(userProfile.id)).unwrap(),
        dispatch(getDailySales(userProfile.id)).unwrap(),
        dispatch(getSalesByPaymentMethod(userProfile.id)).unwrap(),
      ]);
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to fetch sales data",
        variant: "destructive",
      });
    }
  }, [dispatch, toast, userProfile?.id]);

  useEffect(() => {
    if (userProfile?.id) {
      fetchSalesData();
    }
  }, [fetchSalesData, userProfile?.id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Mapped to Backend DailySalesDTO ({ date, totalSales, totalOrders })
  const dailySalesData =
    dailySales?.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sales: Number(item.totalSales ?? item.totalAmount ?? 0),
    })) || [];

  // Mapped to Backend PaymentBreakdownDTO ({ paymentType, totalOrders, totalAmount, percentage })
  const paymentMethodData =
    salesByPaymentMethod?.map((item) => ({
      name: item.paymentType || item.paymentMethod || "UNKNOWN",
      value: Number(item.totalAmount ?? 0),
    })) || [];

  const salesConfig = {
    sales: {
      label: "Sales",
      color: "#10b981",
    },
  };

  const paymentConfig = {
    value: {
      label: "Amount",
      color: "#10b981",
    },
  };

  const totalRevenue =
    storeOverview?.totalRevenue ?? storeOverview?.totalSales ?? 0;
  const totalOrders =
    storeOverview?.totalOrders ?? storeOverview?.todayOrders ?? 0;
  const totalEmployees =
    storeOverview?.totalEmployees ?? storeOverview?.activeCashiers ?? 0;
  const avgOrderValue =
    storeOverview?.avgOrderValue ?? storeOverview?.averageOrderValue ?? 0;
  const monthlyGrowth = storeOverview?.monthlyGrowthRate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Revenue Management
        </h1>
        <AddSaleDialog onSaleAdded={fetchSalesData} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {loading ? (
                    <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
                  ) : (
                    formatCurrency(totalRevenue)
                  )}
                </h3>
                <p className="text-xs text-emerald-500 mt-1">
                  {loading ? (
                    <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
                  ) : (
                    `${monthlyGrowth >= 0 ? "+" : ""}${Number(monthlyGrowth).toFixed(1)}% monthly growth`
                  )}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-full">
                <DollarSign className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Orders
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {loading ? (
                    <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
                  ) : (
                    totalOrders
                  )}
                </h3>
                <p className="text-xs text-emerald-500 mt-1">
                  Across {storeOverview?.totalBranches ?? 0} branches
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Store className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Employees
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {loading ? (
                    <div className="h-8 w-16 bg-muted rounded animate-pulse"></div>
                  ) : (
                    totalEmployees
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Active staff members
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-full">
                <User className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg. Order Value
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {loading ? (
                    <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
                  ) : (
                    formatCurrency(avgOrderValue)
                  )}
                </h3>
                <p className="text-xs text-emerald-500 mt-1">
                  Per completed order
                </p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-full">
                <CreditCard className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Daily Sales (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">
                    Loading chart data...
                  </p>
                </div>
              </div>
            ) : dailySalesData.length > 0 ? (
              <ChartContainer config={salesConfig}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={dailySalesData}>
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `đ${value}`}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                          formatter={(value) => [
                            formatCurrency(value),
                            "Sales",
                          ]}
                        />
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="stroke-emerald-500"
                      activeDot={{ r: 8, fill: "#10b981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">No sales data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">
                    Loading chart data...
                  </p>
                </div>
              </div>
            ) : paymentMethodData.length > 0 ? (
              <ChartContainer config={paymentConfig}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={paymentMethodData}>
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `đ${value}`}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                          formatter={(value) => [
                            formatCurrency(value),
                            "Amount",
                          ]}
                        />
                      )}
                    />
                    <Bar
                      dataKey="value"
                      fill="currentColor"
                      radius={[4, 4, 0, 0]}
                      className="fill-emerald-500"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">
                  No payment data available
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
