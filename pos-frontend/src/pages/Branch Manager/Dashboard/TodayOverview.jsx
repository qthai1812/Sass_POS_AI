import React from "react";
import { useSelector } from "react-redux";
import { getChangeType } from "../data";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Users, Package } from "lucide-react";

const TodayOverview = () => {
  const { todayOverview, loading } = useSelector(
    (state) => state.branchAnalytics,
  );

  // Mapped accurately to Backend BranchOverviewDTO:
  // { todayRevenue, todayOrders, todayRefunds, activeShifts, lowStockItems, avgOrderValue }
  const revenue = todayOverview?.todayRevenue ?? todayOverview?.totalSales ?? 0;
  const orders = todayOverview?.todayOrders ?? todayOverview?.ordersToday ?? 0;
  const activeShifts =
    todayOverview?.activeShifts ?? todayOverview?.activeCashiers ?? 0;
  const lowStock = todayOverview?.lowStockItems ?? 0;
  const avgOrder = todayOverview?.avgOrderValue ?? 0;
  const refunds = todayOverview?.todayRefunds ?? 0;

  const kpis = todayOverview
    ? [
        {
          title: "Today's Sales",
          value: `đ${Number(revenue).toLocaleString()}`,
          icon: <DollarSign className="w-8 h-8 text-primary" />,
          change:
            todayOverview.salesGrowth !== undefined
              ? `${todayOverview.salesGrowth > 0 ? "+" : ""}${todayOverview.salesGrowth.toFixed(2)}%`
              : `Avg Order: đ${Number(avgOrder).toLocaleString()}`,
          changeType: getChangeType(todayOverview.salesGrowth ?? 1),
        },
        {
          title: "Orders Today",
          value: orders,
          icon: <ShoppingBag className="w-8 h-8 text-primary" />,
          change:
            todayOverview.orderGrowth !== undefined
              ? `${todayOverview.orderGrowth > 0 ? "+" : ""}${todayOverview.orderGrowth.toFixed(2)}%`
              : `Refunds: đ${Number(refunds).toLocaleString()}`,
          changeType: getChangeType(todayOverview.orderGrowth ?? 1),
        },
        {
          title: "Active Shifts",
          value: activeShifts,
          icon: <Users className="w-8 h-8 text-primary" />,
          change:
            todayOverview.cashierGrowth !== undefined
              ? `${todayOverview.cashierGrowth > 0 ? "+" : ""}${todayOverview.cashierGrowth.toFixed(2)}%`
              : "Active cashiers on shift",
          changeType: getChangeType(todayOverview.cashierGrowth ?? 0),
        },
        {
          title: "Low Stock Items",
          value: lowStock,
          icon: <Package className="w-8 h-8 text-primary" />,
          change:
            todayOverview.lowStockGrowth !== undefined
              ? `${todayOverview.lowStockGrowth > 0 ? "+" : ""}${todayOverview.lowStockGrowth.toFixed(2)}%`
              : lowStock > 0
                ? "Needs restock attention"
                : "Stock levels healthy",
          changeType: lowStock > 0 ? "negative" : "positive",
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.length > 0 ? (
        kpis.map((kpi, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </p>
                  <h3 className="text-2xl font-bold mt-1">{kpi.value}</h3>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      kpi.changeType === "positive"
                        ? "text-emerald-500"
                        : kpi.changeType === "negative"
                          ? "text-red-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {kpi.change}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">{kpi.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="col-span-4 text-center text-muted-foreground py-6">
          {loading ? "Loading KPIs..." : "No data available"}
        </div>
      )}
    </div>
  );
};

export default TodayOverview;
