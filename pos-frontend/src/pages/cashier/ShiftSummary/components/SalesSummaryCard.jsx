import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const SalesSummaryCard = ({ shiftData }) => {
  const totalSales = Number(shiftData?.totalSales ?? 0);
  const totalRefunds = Number(shiftData?.totalRefunds ?? 0);
  const netSales = Number(
    shiftData?.netSales ?? shiftData?.netSale ?? totalSales - totalRefunds,
  );

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Sales Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Orders:</span>
            <span className="font-medium">{shiftData?.totalOrders ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Sales:</span>
            <span className="font-medium">đ{totalSales.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Total Refunds:</span>
            <span>-đ{totalRefunds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold pt-2 border-t">
            <span>Net Sales:</span>
            <span>đ{netSales.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesSummaryCard;
