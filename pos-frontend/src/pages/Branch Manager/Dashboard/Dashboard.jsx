import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

// Import chart components
import SalesChart from "./SalesChart";
import TopProducts from "./TopProducts";
import CashierPerformance from "./CashierPerformance";
import RecentOrders from "./RecentOrders";
import { getTodayOverview, getPaymentBreakdown } from "@/Redux Toolkit/features/branchAnalytics/branchAnalyticsThunks";
import PaymentBreakdown from "./PaymentBreakdown";
import TodayOverview from "./TodayOverview";
import AiBusinessCopilotCard from "@/components/ai/AiBusinessCopilotCard";
import { getLocalIsoDate } from "@/utils/formateDate";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);
  const branchId = branch?.id || userProfile?.branchId;

  useEffect(() => {
    if (branchId) {
      dispatch(getTodayOverview(branchId));
      const today = getLocalIsoDate();
      dispatch(getPaymentBreakdown({ branchId, date: today }));
    }
  }, [branchId, dispatch]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Branch Dashboard</h1>
        <p className="text-gray-500">{branch?.name || "Loading branch..."}</p>
      </div>

      <AiBusinessCopilotCard
        mode="BRANCH"
        branchId={branchId}
        storeId={store?.id || userProfile?.storeId}
      />

      {/* KPI Cards */}
      <TodayOverview/>
      
      {/* Payment Breakdown */}
      <PaymentBreakdown/>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesChart />
        <TopProducts />
      </div>
      {/* Additional Data */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CashierPerformance />
        <RecentOrders />
      </div>
    </div>
  );
}
