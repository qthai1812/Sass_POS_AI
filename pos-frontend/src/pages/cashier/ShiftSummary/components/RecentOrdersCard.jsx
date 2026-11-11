import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTime } from "../../../../utils/formateDate";
import { getPaymentIcon } from "../../../../utils/getPaymentIcon";

const RecentOrdersCard = ({ shiftData }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiftData.recentOrders?.length > 0 ? shiftData.recentOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  <span>{order.id}</span>
                  {order.status && order.status !== "COMPLETED" && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                      {order.status}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatTime(order.createdAt)}</TableCell>
                <TableCell className="flex items-center gap-1">
                  {order.paymentType ? (
                    <>
                      {getPaymentIcon(order.paymentType)}
                      <span>{order.paymentType}</span>
                    </>
                  ) : (
                    "UNKNOWN"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  đ{order.totalAmount?.toFixed(2)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  No orders recorded during this shift yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RecentOrdersCard;
