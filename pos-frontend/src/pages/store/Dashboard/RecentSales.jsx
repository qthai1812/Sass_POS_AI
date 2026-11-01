import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBranchPerformance } from "@/Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";
import { Store, TrendingUp, ShoppingCart } from "lucide-react";

const RecentSales = () => {
  const dispatch = useDispatch();
  const { branchPerformance, loading } = useSelector(
    (state) => state.storeAnalytics,
  );
  const { userProfile } = useSelector((state) => state.user);

  useEffect(() => {
    if (userProfile?.id) {
      dispatch(getBranchPerformance(userProfile.id));
    }
  }, [dispatch, userProfile]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center justify-between">
          <span>Hiệu suất các chi nhánh</span>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Đang tải dữ liệu chi nhánh...
          </div>
        ) : !branchPerformance || branchPerformance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Chưa có dữ liệu hiệu suất chi nhánh.
          </div>
        ) : (
          <div className="space-y-4">
            {branchPerformance.map((branch) => (
              <div
                key={branch.branchId}
                className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">{branch.branchName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>
                        <ShoppingCart className="w-3 h-3 inline mr-1" />
                        {branch.totalOrders} đơn
                      </span>
                      <span>•</span>
                      <span>{branch.totalEmployees} nhân sự</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-base text-emerald-600">
                    {formatCurrency(branch.totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    TB: {formatCurrency(branch.avgOrderValue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentSales;
