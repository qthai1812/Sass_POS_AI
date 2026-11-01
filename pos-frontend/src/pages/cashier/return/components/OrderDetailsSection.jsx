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
import { formatDate } from "../../order/data";

const OrderDetailsSection = ({ selectedOrder, setSelectedOrder }) => {
  const { refundsByBranch = [] } = useSelector((state) => state.refund);

  const { alreadyRefunded, returnedByOrderItemId } = useMemo(() => {
    const orderRefunds = (refundsByBranch || []).filter(
      (r) => r?.orderId === selectedOrder?.id,
    );
    let refundedSum = 0;
    const itemMap = new Map();
    const productFallback = new Map();

    for (const r of orderRefunds) {
      refundedSum += Number(r?.amount || 0);
      for (const ri of r?.items || []) {
        const q = Number(ri?.quantity || 0);
        if (q <= 0) continue;
        if (ri.orderItemId != null) {
          itemMap.set(ri.orderItemId, (itemMap.get(ri.orderItemId) || 0) + q);
        } else if (ri.productId != null) {
          productFallback.set(
            ri.productId,
            (productFallback.get(ri.productId) || 0) + q,
          );
        }
      }
    }

    for (const oi of selectedOrder?.items || []) {
      if (!itemMap.has(oi.id) && oi.product?.id != null) {
        const fb = productFallback.get(oi.product.id) || 0;
        if (fb > 0) {
          const consume = Math.min(Number(oi.quantity || 0), fb);
          itemMap.set(oi.id, consume);
          productFallback.set(oi.product.id, fb - consume);
        }
      }
    }

    return {
      alreadyRefunded: refundedSum,
      returnedByOrderItemId: itemMap,
    };
  }, [refundsByBranch, selectedOrder]);

  const orderTotal = Number(selectedOrder?.totalAmount || 0);
  const remainingRefundable = Math.max(0, orderTotal - alreadyRefunded);

  return (
    <div className="w-1/2 border-r p-4 flex flex-col">
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedOrder(null)}
        >
          ← Back to Order Search
        </Button>
      </div>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-semibold text-lg">
                Order #{selectedOrder.id}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(selectedOrder.createdAt)}
              </p>
            </div>
            <Badge variant="outline">{selectedOrder.paymentType}</Badge>
          </div>
          <div className="mb-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-2">
              Customer
            </h3>
            <p>{selectedOrder?.customer?.fullName || "Walk-in Customer"}</p>
            <p className="text-sm">{selectedOrder.customer?.phone}</p>
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
      <div className="flex-1 overflow-auto">
        <h3 className="font-semibold mb-2">Order Items</h3>
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
              const unitPrice = Number(
                item.product?.sellingPrice ??
                  (item.price && qty > 0 ? item.price / qty : 0),
              );
              const lineTotal = Number(item.price ?? unitPrice * qty);

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product?.name || "Deleted Product"}
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
                    ₫{unitPrice.toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right">
                    ₫{lineTotal.toLocaleString("vi-VN")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderDetailsSection;
