import React, { useEffect } from "react";
import { Card } from "../../../components/ui/card";
import InactiveCashierTable from "./InactiveCashierTable";
import LowStockProductTable from "./LowStockProductTable";
import NoSaleTodayBranchTable from "./NoSaleTodayBranchTable";
import RefundSpikeTable from "./RefundSpikeTable";
import { useDispatch, useSelector } from "react-redux";
import { getStoreAlerts } from "../../../Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";

const Alerts = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.userProfile);

  useEffect(() => {
    if (user?.id) {
      dispatch(getStoreAlerts(user.id));
    }
  }, [dispatch, user?.id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      <Card className="min-h-96 p-5">
        <h2 className="font-bold text-xl mb-4">Inactive Cashiers</h2>
        <InactiveCashierTable />
      </Card>

      <Card className="min-h-96 p-5">
        <h2 className="font-bold text-xl mb-4">Low Stock Alerts</h2>
        <LowStockProductTable />
      </Card>

      <Card className="min-h-96 p-5">
        <h2 className="font-bold text-xl mb-4">No Sale Today</h2>
        <NoSaleTodayBranchTable />
      </Card>

      <Card className="min-h-96 p-5">
        <h2 className="font-bold text-xl mb-4">Refund Spike</h2>
        <RefundSpikeTable />
      </Card>
    </div>
  );
};

export default Alerts;
