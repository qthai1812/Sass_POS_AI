import React from "react";
import { useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrinterIcon } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { getHistoricalUnitPrice } from "../returnUtils";
import { getBranchPrinterSettings } from "@/utils/branchPrinterSettings";

const ReturnReceiptDialog = ({
  showReceiptDialog,
  setShowReceiptDialog,
  selectedOrder,
  refundId,
  returnReason,
  refundMethod,
  refundAmount,
  returnedItems,
  refundMode = "ITEMS",
}) => {
  const { branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);
  const printerSettings = getBranchPrinterSettings();

  const headerTitle = store?.brand || branch?.name || "POS SYSTEM";
  const headerAddress = branch?.address || store?.contact?.address || "";
  const headerPhone = branch?.phone || store?.contact?.phone || "";
  const footerText =
    printerSettings.footerText?.trim() ||
    store?.receiptFooter ||
    "Thank you for shopping with us!";

  const hasSpecificReturnedItems =
    Array.isArray(returnedItems) && returnedItems.length > 0;
  const displayTotalRefund = Number(
    refundAmount ?? selectedOrder?.totalAmount ?? 0,
  );
  const isAmountOnlyAdjustment =
    !hasSpecificReturnedItems && refundMode === "AMOUNT";
  const displayItems = hasSpecificReturnedItems
    ? returnedItems
    : isAmountOnlyAdjustment
      ? []
      : selectedOrder?.items || [];

  return (
    <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
      <DialogContent
        overlayClassName="no-print"
        data-paper-size={printerSettings.paperSize}
        className="print-modal-root print-scroll-reset"
      >
        <DialogHeader>
          <DialogTitle>Return Receipt</DialogTitle>
        </DialogHeader>
        <div className="bg-background text-foreground p-6 max-h-96 overflow-y-auto border rounded-md print-scroll-reset print:border-0 print:p-0">
          <div
            className={`text-center mb-4 ${printerSettings.printLogo ? "" : "print:hidden"}`}
          >
            <h3 className="font-bold text-lg">{headerTitle}</h3>
            {headerAddress && <p className="text-sm">{headerAddress}</p>}
            {headerPhone && <p className="text-sm">Tel: {headerPhone}</p>}
          </div>
          <div className="text-center mb-4">
            <h4 className="font-bold">RETURN RECEIPT</h4>
          </div>
          <div className="mb-4">
            <p className="text-sm">
              <span className="font-medium">Return #:</span> RTN-
              {refundId || selectedOrder?.id}
            </p>
            <p className="text-sm">
              <span className="font-medium">Original Order:</span> #
              {selectedOrder?.id}
            </p>
            <p className="text-sm">
              <span className="font-medium">Date:</span>{" "}
              {new Date().toLocaleString()}
            </p>
            <p
              className={`text-sm ${printerSettings.printCustomerDetails ? "" : "no-print"}`}
            >
              <span className="font-medium">Customer:</span>{" "}
              {selectedOrder?.customer?.fullName || "Walk-in Customer"}
            </p>
          </div>
          <Table className="w-full text-sm mb-4">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left py-2">Item</TableHead>
                <TableHead className="text-center py-2">Qty</TableHead>
                <TableHead className="text-right py-2">Price</TableHead>
                <TableHead className="text-right py-2">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAmountOnlyAdjustment ? (
                <TableRow>
                  <TableCell className="py-2 font-medium" colSpan={3}>
                    Partial Amount Refund (No Stock Returned)
                  </TableCell>
                  <TableCell className="text-right py-2 font-medium">
                    ₫{displayTotalRefund.toLocaleString("vi-VN")}
                  </TableCell>
                </TableRow>
              ) : (
                displayItems.map((item, idx) => {
                  const qty = Number(item.quantity || 1);
                  const unitPrice = hasSpecificReturnedItems
                    ? Number(item.unitPrice ?? 0)
                    : getHistoricalUnitPrice(item);
                  const lineTotal = hasSpecificReturnedItems
                    ? Number(item.refundAmount ?? unitPrice * qty)
                    : Number(item.price ?? unitPrice * qty);
                  const itemName =
                    item.productName ||
                    item.product?.name ||
                    "Unknown Product";

                  return (
                    <TableRow key={item.id || item.orderItemId || idx}>
                      <TableCell className="py-2">
                        {itemName.length > 24
                          ? `${itemName.slice(0, 24)}...`
                          : itemName}
                      </TableCell>
                      <TableCell className="text-center py-2">{qty}</TableCell>
                      <TableCell className="text-right py-2">
                        ₫{Math.round(Number(unitPrice || 0)).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        ₫{Math.round(Number(lineTotal || 0)).toLocaleString("vi-VN")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between font-bold border-t pt-1">
              <span>Total Refund</span>
              <span>₫{displayTotalRefund.toLocaleString("vi-VN")}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Refund Method</span>
              <span>{refundMethod || selectedOrder?.paymentType}</span>
            </div>
            {returnReason && (
              <div className="flex justify-between pt-1">
                <span>Return Reason</span>
                <span>{returnReason}</span>
              </div>
            )}
          </div>
          <div className="text-center text-sm mt-6">
            <p>{footerText}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Return Policy: Items can be returned within 7 days of purchase
              with receipt
            </p>
          </div>
        </div>
        <DialogFooter className="no-print flex justify-between w-full">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.print()}
          >
            <PrinterIcon className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={() => setShowReceiptDialog(false)}>Complete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnReceiptDialog;
