import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  getSalesTrends,
  getDailySales,
} from "@/Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";
import { useToast } from "@/components/ui/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const SalesTrend = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { salesTrends, dailySales, loading } = useSelector(
    (state) => state.storeAnalytics,
  );
  const { userProfile } = useSelector((state) => state.user);
  const [period, setPeriod] = useState("daily");

  const fetchSalesData = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      if (period === "daily") {
        await dispatch(getDailySales(userProfile.id)).unwrap();
      } else {
        await dispatch(
          getSalesTrends({ storeAdminId: userProfile.id, period }),
        ).unwrap();
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to fetch sales data",
        variant: "destructive",
      });
    }
  }, [dispatch, period, toast, userProfile?.id]);

  useEffect(() => {
    if (userProfile?.id) {
      fetchSalesData();
    }
  }, [fetchSalesData, userProfile?.id]);

  const formatCurrency = (value) => {
    return `đ${Number(value || 0).toLocaleString("vi-VN")}`;
  };

  // Mapped to Backend DailySalesDTO ({ date, totalSales, totalOrders }) & SalesTrendDTO ({ period, totalSales })
  const getChartData = () => {
    if (period === "daily" && dailySales) {
      return dailySales.map((item) => ({
        date: new Date(item.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        sales: Number(item.totalSales ?? item.totalAmount ?? 0),
      }));
    } else if (salesTrends) {
      return salesTrends.map((item) => ({
        date: item.period,
        sales: Number(item.totalSales ?? item.totalAmount ?? 0),
      }));
    }
    return [];
  };

  const chartData = getChartData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Sales Trend</CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-2 text-muted-foreground">
                Loading sales data...
              </p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
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
              <Tooltip
                formatter={(value) => [formatCurrency(value), "Sales"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <TrendingUp className="w-16 h-16 text-emerald-500 mx-auto" />
              <p className="mt-2 text-muted-foreground">
                No sales data available
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTrend;
