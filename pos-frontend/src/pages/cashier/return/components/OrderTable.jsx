import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchIcon } from "lucide-react";
import { formatDate } from "../../order/data";
import { useSelector } from "react-redux";

const OrderTable = ({ handleSelectOrder }) => {
  const { orders = [], loading, error } = useSelector((state) => state.order);
  const { refundsByBranch = [] } = useSelector((state) => state.refund);
  const [searchQuery, setSearchQuery] = useState("");

  const refundedAmountByOrderId = useMemo(() => {
    const map = new Map();
    for (const r of refundsByBranch || []) {
      if (r?.orderId != null) {
        map.set(
          r.orderId,
          (map.get(r.orderId) || 0) + Number(r.amount || 0),
        );
      }
    }
    return map;
  }, [refundsByBranch]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) =>
        String(order.id).toLowerCase().includes(q) ||
        (order.customer?.fullName || "").toLowerCase().includes(q) ||
        (order.paymentType || "").toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  return (
    <div className="w-full p-4 flex flex-col">
      <div className="mb-4 max-w-md relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by Order ID, customer name, or payment mode..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <span>Loading orders...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
            <span>{error}</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const statusUpper = String(order.status || "").toUpperCase();
                const orderTotal = Number(order.totalAmount || 0);
                const refundedSoFar = Number(
                  refundedAmountByOrderId.get(order.id) || 0,
                );
                const isFullyRefunded =
                  statusUpper === "REFUNDED" ||
                  (orderTotal > 0 && refundedSoFar >= orderTotal - 0.01);
                const isPartiallyRefunded =
                  !isFullyRefunded && refundedSoFar > 0;
                const isCancelled = statusUpper === "CANCELLED";
                const isPending = statusUpper === "PENDING";

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>#{order.id}</span>
                        {isPartiallyRefunded && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/40 text-amber-600"
                          >
                            Partial Refund
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      {order.customer?.fullName || "Walk-in Customer"}
                    </TableCell>
                    <TableCell>
                      <div>
                        ₫{orderTotal.toLocaleString("vi-VN")}
                      </div>
                      {isPartiallyRefunded && (
                        <div className="text-xs text-muted-foreground">
                          Remaining: ₫
                          {Math.max(
                            0,
                            orderTotal - refundedSoFar,
                          ).toLocaleString("vi-VN")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{order.paymentType || "CASH"}</TableCell>
                    <TableCell className="text-right">
                      {isFullyRefunded ? (
                        <Button disabled variant="secondary">
                          Refunded
                        </Button>
                      ) : isCancelled ? (
                        <Button disabled variant="secondary">
                          Cancelled
                        </Button>
                      ) : isPending ? (
                        <Button disabled variant="secondary">
                          Pending
                        </Button>
                      ) : (
                        <Button
                          variant={isPartiallyRefunded ? "outline" : "default"}
                          onClick={() => handleSelectOrder(order)}
                        >
                          {isPartiallyRefunded
                            ? "Return Remaining"
                            : "Select for Return"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <SearchIcon size={48} strokeWidth={1} />
            <p className="mt-4">No orders found</p>
            <p className="text-sm">
              Try searching by order ID or customer name
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTable;
