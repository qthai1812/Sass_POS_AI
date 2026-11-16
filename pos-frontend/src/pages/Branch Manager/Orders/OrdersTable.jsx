import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import OrderActionButtons from "@/components/OrderActionButtons";

const OrdersTable = ({
  orders = [],
  loading,
  onViewDetails,
  onPrintInvoice,
  getStatusColor,
  getPaymentIcon,
  sortBy,
  sortDir,
  onSortChange,
}) => {
  const [localSortField, setLocalSortField] = useState("id");
  const [localSortAsc, setLocalSortAsc] = useState(false);
  const isServerSort = typeof onSortChange === "function";

  const handleSort = (field) => {
    if (isServerSort) {
      onSortChange(field);
      return;
    }
    if (localSortField === field) {
      setLocalSortAsc((prev) => !prev);
    } else {
      setLocalSortField(field);
      setLocalSortAsc(true);
    }
  };

  const renderSortIcon = (field) => {
    if (!isServerSort) {
      return <ArrowUpDown className="h-3 w-3" />;
    }
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary" />
    );
  };

  const sortedOrders = useMemo(() => {
    if (isServerSort) {
      return orders;
    }
    return [...orders].sort((a, b) => {
      let valA = a[localSortField];
      let valB = b[localSortField];
      if (localSortField === "createdAt") {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      return localSortAsc ? valA - valB : valB - valA;
    });
  }, [orders, isServerSort, localSortField, localSortAsc]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[110px]">
            <button
              type="button"
              onClick={() => handleSort("id")}
              className="flex items-center gap-1 font-medium hover:text-foreground"
            >
              Order ID
              {renderSortIcon("id")}
            </button>
          </TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Cashier</TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("createdAt")}
              className="flex items-center gap-1 font-medium hover:text-foreground"
            >
              Date
              {renderSortIcon("createdAt")}
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              onClick={() => handleSort("totalAmount")}
              className="flex items-center gap-1 font-medium hover:text-foreground"
            >
              Amount
              {renderSortIcon("totalAmount")}
            </button>
          </TableHead>
          <TableHead>Payment Mode</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-4 text-gray-400">
              Loading orders...
            </TableCell>
          </TableRow>
        ) : sortedOrders.length > 0 ? (
          sortedOrders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.id}</TableCell>
              <TableCell>
                {order.customer?.fullName || "Walk-in Customer"}
              </TableCell>
              <TableCell>
                {order.cashier?.fullName || order.cashierId || "-"}
              </TableCell>
              <TableCell>
                {order.createdAt ? order.createdAt.slice(0, 10) : "-"}
              </TableCell>
              <TableCell>
                {order.totalAmount != null
                  ? `₫${Math.round(Number(order.totalAmount)).toLocaleString("vi-VN")}`
                  : "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getPaymentIcon(order.paymentType)} {order.paymentType || "-"}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  className={getStatusColor(order.status)}
                  variant="secondary"
                >
                  {order.status || "COMPLETED"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetails(order.id)}
                    title="View Details"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onPrintInvoice(order.id)}
                    title="Download / Print Invoice"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <OrderActionButtons order={order} />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-4 text-gray-500">
              No orders found matching your criteria
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default OrdersTable;
