import React from "react";
import { formatDate, getStatusColor } from "./data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { EyeIcon, PrinterIcon, RotateCcwIcon } from "lucide-react";

const OrderTable = ({
  orders,
  handleViewOrder,
  handlePrintInvoice,
  handleInitiateReturn,
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Date/Time</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Payment Mode</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const statusUpper = String(order.status || "COMPLETED").toUpperCase();
          const isNonReturnable =
            statusUpper === "REFUNDED" ||
            statusUpper === "CANCELLED" ||
            statusUpper === "PENDING";

          return (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.id}</TableCell>
              <TableCell>{formatDate(order.createdAt)}</TableCell>
              <TableCell>
                {order.customer?.fullName || "Walk-in Customer"}
              </TableCell>
              <TableCell>
                ₫{Number(order.totalAmount || 0).toLocaleString("vi-VN")}
              </TableCell>
              <TableCell>{order.paymentType || "CASH"}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={getStatusColor(statusUpper)}
                >
                  {statusUpper}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View Order"
                    onClick={() => handleViewOrder(order)}
                  >
                    <EyeIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Print Invoice"
                    onClick={() => handlePrintInvoice(order)}
                  >
                    <PrinterIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isNonReturnable}
                    title={
                      isNonReturnable
                        ? `Order already ${statusUpper.toLowerCase()}`
                        : "Return / Refund"
                    }
                    onClick={() => handleInitiateReturn(order)}
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default OrderTable;
