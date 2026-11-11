import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
} from "lucide-react";
import TransactionTable from "./TransactionTable";
import { useSelector, useDispatch } from "react-redux";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";
import { getRefundsByBranch } from "../../../Redux Toolkit/features/refund/refundThunks";
import { useToast } from "@/components/ui/use-toast";
import { handleDownloadOrderPDF } from "../../cashier/order/pdf/pdfUtils";
import { formatDate, getStatusColor } from "../../cashier/order/data";

export default function Transactions() {
  const { orders = [] } = useSelector((state) => state.order);
  const { refundsByBranch = [] } = useSelector((state) => state.refund || {});
  const { branch } = useSelector((state) => state.branch);
  const dispatch = useDispatch();
  const { toast } = useToast();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (branch?.id) {
      dispatch(getOrdersByBranch({ branchId: branch.id }));
      dispatch(getRefundsByBranch(branch.id));
    }
  }, [branch?.id, dispatch]);

  const refundedByOrderId = useMemo(() => {
    const map = new Map();
    for (const r of refundsByBranch || []) {
      if (r?.orderId != null) {
        map.set(
          r.orderId,
          (map.get(r.orderId) || 0) + Math.abs(Number(r.amount || 0)),
        );
      }
    }
    return map;
  }, [refundsByBranch]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (t) =>
        String(t.id).toLowerCase().includes(q) ||
        (t.customer?.fullName || "Walk-in Customer")
          .toLowerCase()
          .includes(q) ||
        (t.cashier?.fullName || "").toLowerCase().includes(q) ||
        (t.paymentType || "").toLowerCase().includes(q) ||
        (t.status || "").toLowerCase().includes(q),
    );
  }, [orders, searchQuery]);

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => {
          const st = String(t.status || "COMPLETED").toUpperCase();
          return (
            Number(t.totalAmount || 0) > 0 &&
            st !== "CANCELLED" &&
            st !== "PENDING"
          );
        })
        .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0),
    [filteredTransactions],
  );

  const totalExpenses = useMemo(() => {
    const refundedOrdersTotal = filteredTransactions
      .filter((t) => String(t.status || "").toUpperCase() === "REFUNDED")
      .reduce((sum, t) => sum + Math.abs(Number(t.totalAmount || 0)), 0);

    const hasSearch = Boolean(searchQuery.trim());
    if (hasSearch) {
      const matchedOrderIds = new Set(filteredTransactions.map((t) => t.id));
      const matchedRefundsTotal = (refundsByBranch || [])
        .filter((r) => matchedOrderIds.has(r.orderId))
        .reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0);
      return matchedRefundsTotal > 0 ? matchedRefundsTotal : refundedOrdersTotal;
    }

    const branchRefundsTotal = (refundsByBranch || []).reduce(
      (sum, r) => sum + Math.abs(Number(r.amount || 0)),
      0,
    );
    return branchRefundsTotal > 0 ? branchRefundsTotal : refundedOrdersTotal;
  }, [filteredTransactions, refundsByBranch, searchQuery]);

  const netAmount = totalIncome - totalExpenses;

  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };

  const handleExportTransactions = () => {
    if (!filteredTransactions.length) {
      toast({
        title: "No Data to Export",
        description: "There are no transactions matching your current filter.",
        variant: "destructive",
      });
      return;
    }
    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Order ID",
      "Date",
      "Cashier",
      "Customer",
      "Payment Method",
      "Amount (VND)",
      "Refunded (VND)",
      "Status",
    ];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.createdAt || "",
      t.cashier?.fullName || "N/A",
      t.customer?.fullName || "Walk-in Customer",
      t.paymentType || "CASH",
      Number(t.totalAmount || 0),
      Number(refundedByOrderId.get(t.id) || 0),
      String(t.status || "COMPLETED").toUpperCase(),
    ]);
    const csvBody = [headers, ...rows]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvBody], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `transactions_branch_${branch?.id || "all"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
      title: "Transactions Exported",
      description: `Exported ${filteredTransactions.length} transaction(s) to CSV.`,
    });
  };

  const handlePrintReceipt = async () => {
    if (!selectedTransaction) return;
    await handleDownloadOrderPDF(selectedTransaction, toast);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <Button
          onClick={handleExportTransactions}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Download className="mr-2 h-4 w-4" /> Export Transactions
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Income
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  ₫{Number(totalIncome || 0).toLocaleString("vi-VN")}
                </h3>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ArrowUpRight className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  ₫{Number(totalExpenses || 0).toLocaleString("vi-VN")}
                </h3>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <ArrowDownLeft className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Net Amount
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  ₫{Number(netAmount || 0).toLocaleString("vi-VN")}
                </h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <span className="h-6 w-6 text-blue-600 font-bold flex items-center justify-center text-sm">
                  VNĐ
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Order ID, customer, cashier, status, or payment type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <TransactionTable
        filteredTransactions={filteredTransactions}
        handleViewTransaction={handleViewTransaction}
        refundedByOrderId={refundedByOrderId}
      />

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Transaction Details - #ORD-{selectedTransaction?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (() => {
            const txStatus = String(
              selectedTransaction.status || "COMPLETED",
            ).toUpperCase();
            const txTotal = Math.abs(
              Number(selectedTransaction.totalAmount || 0),
            );
            const txRefunded = Number(
              refundedByOrderId.get(selectedTransaction.id) || 0,
            );
            const isFullRefund = txStatus === "REFUNDED";
            const isPartialRefund =
              txStatus === "PARTIALLY_REFUNDED" ||
              (!isFullRefund && txRefunded > 0);
            const netCollected = Math.max(0, txTotal - txRefunded);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Cashier
                    </p>
                    <p>{selectedTransaction.cashier?.fullName || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Date &amp; Time
                    </p>
                    <p>{formatDate(selectedTransaction.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Type
                    </p>
                    <p>
                      <Badge variant="outline">
                        {isFullRefund
                          ? "Refunded Sale"
                          : isPartialRefund
                            ? "Partial Refund"
                            : "Sale"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Status
                    </p>
                    <p>
                      <Badge
                        variant="outline"
                        className={getStatusColor(txStatus)}
                      >
                        {txStatus}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Payment Method
                    </p>
                    <p>{selectedTransaction.paymentType || "CASH"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Amount
                    </p>
                    <p
                      className={`font-bold ${
                        isFullRefund
                          ? "text-red-600"
                          : isPartialRefund
                            ? "text-amber-600"
                            : "text-green-600"
                      }`}
                    >
                      ₫{txTotal.toLocaleString("vi-VN")}
                    </p>
                    {txRefunded > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Refunded: -₫{txRefunded.toLocaleString("vi-VN")} • Net: ₫
                        {netCollected.toLocaleString("vi-VN")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Sale Details</h4>
                  <p className="text-sm text-muted-foreground">
                    Invoice: INV-{selectedTransaction.id}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customer:{" "}
                    {selectedTransaction.customer?.fullName ||
                      "Walk-in Customer"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Items: {selectedTransaction.items?.length || 0}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={handlePrintReceipt}>
                    <Printer className="h-4 w-4 mr-1" /> Print / Download Receipt
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
