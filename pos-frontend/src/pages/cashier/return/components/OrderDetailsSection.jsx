import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, getStatusColor } from "../../order/data";
import {
  buildReturnableItems,
  getHistoricalUnitPrice,
  mergeOrderRefunds,
} from "../returnUtils";

const OrderDetailsSection = ({ selectedOrder, setSelectedOrder }) => {
  const { refundsByBranch = [], refundsByOrder = [] } = useSelector(
    (state) => state.refund,
  );

  const { alreadyRefunded, remainingRefundable, returnedByOrderItemId } =
    useMemo(() => {
      const orderRefunds = mergeOrderRefunds(
        selectedOrder?.id,
        refundsByOrder,
        refundsByBranch,
      );
      return buildReturnableItems(selectedOrder, orderRefunds);
    }, [refundsByBranch, refundsByOrder, selectedOrder]);

  const orderTotal = Number(selectedOrder?.totalAmount || 0);
  const subTotal = Number(selectedOrder?.subTotal || 0);
  const taxAmount = Number(selectedOrder?.taxAmount || 0);
  const discountAmount = Number(selectedOrder?.discountAmount || 0);
  const statusUpper = String(selectedOrder?.status || "COMPLETED").toUpperCase();

  return (
    <div className="w-full lg:w-1/2 lg:border-r p-4 flex flex-col min-h-0 overflow-y-auto">
      <div className="mb-4 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedOrder(null)}
        >
          ← Back to Order Search
        </Button>
      </div>
      <Card className="mb-4 shrink-0">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div>
              <h2 className="font-semibold text-lg">
                Order #{selectedOrder.id}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(selectedOrder.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={getStatusColor(statusUpper)}
              >
                {statusUpper}
              </Badge>
              <Badge variant="outline">{selectedOrder.paymentType}</Badge>
            </div>
          </div>
          <div className="mb-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-1">
              Customer
            </h3>
            <p>{selectedOrder?.customer?.fullName || "Walk-in Customer"}</p>
            {selectedOrder.customer?.phone && (
              <p className="text-sm text-muted-foreground">
                {selectedOrder.customer.phone}
              </p>
            )}
          </div>
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-2">
              Order Summary
            </h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span>
                  {(selectedOrder.items || []).reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0,
                  )}
                </span>
              </div>
              {subTotal > 0 && subTotal !== orderTotal && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₫{subTotal.toLocaleString("vi-VN")}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (VAT):</span>
                  <span>+₫{taxAmount.toLocaleString("vi-VN")}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Discount
                    {selectedOrder?.couponCode
                      ? ` (${selectedOrder.couponCode})`
                      : ""}
                    :
                  </span>
                  <span>-₫{discountAmount.toLocaleString("vi-VN")}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Order Total:</span>
                <span>₫{orderTotal.toLocaleString("vi-VN")}</span>
              </div>
              {alreadyRefunded > 0 && (
                <>
                  <div className="flex justify-between text-amber-600">
                    <span>Already Refunded:</span>
                    <span>-₫{alreadyRefunded.toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-600 pt-1 border-t">
                    <span>Remaining Refundable:</span>
                    <span>₫{remainingRefundable.toLocaleString("vi-VN")}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="shrink-0">
        <h3 className="font-semibold mb-2">Order Items</h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Returned</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(selectedOrder.items || []).map((item) => {
                const qty = Number(item.quantity || 0);
                const returnedQty = Number(
                  returnedByOrderItemId.get(item.id) || 0,
                );
                const unitPrice = getHistoricalUnitPrice(item);
                const lineTotal = Number(item.price ?? unitPrice * qty);

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.product?.name || item.productName || "Deleted Product"}
                    </TableCell>
                    <TableCell className="text-center">{qty}</TableCell>
                    <TableCell className="text-center">
                      {returnedQty > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {returnedQty}
                        </Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      ₫{Math.round(unitPrice).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right">
                      ₫{Math.round(lineTotal).toLocaleString("vi-VN")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsSection;
