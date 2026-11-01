import React from "react";
import { useSelector } from "react-redux";
import DashboardStats from "./DashboardStats";
import RecentSales from "./RecentSales";
import SalesTrend from "./SalesTrend";
import AiBusinessCopilotCard from "@/components/ai/AiBusinessCopilotCard";

export default function Dashboard() {
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* AI Business & Inventory Copilot */}
      <AiBusinessCopilotCard
        mode="STORE"
        storeAdminId={userProfile?.id}
        storeId={store?.id || userProfile?.storeId}
      />

      {/* Stats Overview */}
      <DashboardStats />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Recent Sales */}
        <RecentSales />

        {/* Sales Trend */}
        <SalesTrend />
      </div>
    </div>
  );
}
