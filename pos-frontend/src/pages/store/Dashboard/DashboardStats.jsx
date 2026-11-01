import React, { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Store, ShoppingCart, Users } from "lucide-react";
import { getStoreOverview } from "@/Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";
import { useToast } from "@/components/ui/use-toast";

const DashboardStats = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { storeOverview, loading } = useSelector(
    (state) => state.storeAnalytics
  );
  const { userProfile } = useSelector((state) => state.user);

  const fetchStoreOverview = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      await dispatch(getStoreOverview(userProfile.id)).unwrap();
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to fetch store overview",
        variant: "destructive",
      });
    }
  }, [dispatch, toast, userProfile?.id]);

  useEffect(() => {
    if (userProfile?.id) {
      fetchStoreOverview();
    }
  }, [fetchStoreOverview, userProfile?.id]);

  const formatCurrency = (amount) => {
    return `đ${Number(amount || 0).toLocaleString("vi-VN")}`;
  };

  // Mapped accurately to Backend StoreOverviewDTO:
  // { totalRevenue, totalOrders, totalBranches, totalProducts, totalEmployees, avgOrderValue, monthlyGrowthRate }
  const totalRevenue =
    storeOverview?.totalRevenue ?? storeOverview?.totalSales ?? 0;
  const growthRate = storeOverview?.monthlyGrowthRate ?? 0;
  const growthLabel = `${growthRate >= 0 ? "+" : ""}${Number(growthRate).toFixed(1)}%`;

  const stats = [
    {
      title: "Total Sales",
      value: formatCurrency(totalRevenue),
      icon: <DollarSign className="w-8 h-8 text-emerald-500" />,
      change: growthLabel,
      loading: loading,
    },
    {
      title: "Total Branches",
      value: storeOverview?.totalBranches ?? 0,
      icon: <Store className="w-8 h-8 text-emerald-500" />,
      change: `${storeOverview?.totalOrders ?? 0} total orders`,
      loading: loading,
    },
    {
      title: "Total Products",
      value: storeOverview?.totalProducts ?? 0,
      icon: <ShoppingCart className="w-8 h-8 text-emerald-500" />,
      change: `Avg Order: ${formatCurrency(storeOverview?.avgOrderValue ?? 0)}`,
      loading: loading,
    },
    {
      title: "Total Employees",
      value: storeOverview?.totalEmployees ?? 0,
      icon: <Users className="w-8 h-8 text-emerald-500" />,
      change: "+Active across branches",
      loading: loading,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {stat.loading ? (
                    <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
                  ) : (
                    stat.value
                  )}
                </h3>
                <div
                  className={`text-xs font-medium mt-1 ${
                    stat.change.startsWith("-")
                      ? "text-red-500"
                      : "text-emerald-500"
                  }`}
                >
                  {stat.loading ? (
                    <div className="h-4 w-16 bg-muted rounded animate-pulse"></div>
                  ) : (
                    stat.change
                  )}
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-full">
                {stat.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;
