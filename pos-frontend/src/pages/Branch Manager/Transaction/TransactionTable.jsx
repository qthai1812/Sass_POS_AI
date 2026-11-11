import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Eye } from "lucide-react";
import { formatDate, getStatusColor } from "../../cashier/order/data";

const TransactionTable = ({
  filteredTransactions,
  handleViewTransaction,
  refundedByOrderId = new Map(),
}) => {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => {
                const statusUpper = String(
                  transaction.status || "COMPLETED",
                ).toUpperCase();
                const amount = Number(transaction.totalAmount || 0);
                const refundedAmount = Number(
                  refundedByOrderId?.get?.(transaction.id) || 0,
                );
                const isRefunded = statusUpper === "REFUNDED" || amount < 0;
                const isCancelled = statusUpper === "CANCELLED";
                const isPartiallyRefunded =
                  statusUpper === "PARTIALLY_REFUNDED" ||
                  (!isRefunded && !isCancelled && refundedAmount > 0);

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      #{transaction.id}
                    </TableCell>
                    <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                        {transaction.cashier?.fullName || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {transaction.customer?.fullName || "Walk-in Customer"}
                    </TableCell>
                    <TableCell
                      className={
                        isCancelled
                          ? "text-muted-foreground line-through font-medium"
                          : isRefunded
                            ? "text-red-600 font-medium"
                            : isPartiallyRefunded
                              ? "text-amber-600 font-medium"
                              : "text-green-600 font-medium"
                      }
                    >
                      <div>
                        {isCancelled
                          ? `₫${Math.abs(amount).toLocaleString("vi-VN")}`
                          : isRefunded
                            ? `-₫${Math.abs(amount).toLocaleString("vi-VN")}`
                            : `+₫${Math.abs(amount).toLocaleString("vi-VN")}`}
                      </div>
                      {isPartiallyRefunded && refundedAmount > 0 && (
                        <div className="text-xs text-muted-foreground font-normal">
                          Refunded: -₫{refundedAmount.toLocaleString("vi-VN")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{transaction.paymentType || "CASH"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusColor(statusUpper)}
                      >
                        {statusUpper}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewTransaction(transaction)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TransactionTable;
