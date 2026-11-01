import React from "react";
import { Card, CardContent } from "../../../../components/ui/card";
import { formatDate, getPaymentModeLabel } from "../data";

const OrderInformation = ({ selectedOrder }) => {
  const taxPctLabel =
    selectedOrder.subTotal > 0 && selectedOrder.taxAmount > 0
      ? ` (${Math.round((selectedOrder.taxAmount / selectedOrder.subTotal) * 100)}%)`
      : "";

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">Order Information</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{formatDate(selectedOrder.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method:</span>
            <span>{getPaymentModeLabel(selectedOrder.paymentType)}</span>
          </div>
          {selectedOrder.subTotal !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>
                ₫{Number(selectedOrder.subTotal || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          )}
          {selectedOrder.taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax{taxPctLabel}:</span>
              <span>
                ₫{Number(selectedOrder.taxAmount || 0).toLocaleString("vi-VN")}
              </span>
            </div>
          )}
          {selectedOrder.discountAmount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>
                Discount{" "}
                {selectedOrder.couponCode
                  ? `(${selectedOrder.couponCode})`
                  : ""}
                :
              </span>
              <span>
                -₫
                {Number(selectedOrder.discountAmount || 0).toLocaleString(
                  "vi-VN",
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t">
            <span className="text-muted-foreground font-medium">
              Total Amount:
            </span>
            <span className="font-bold text-emerald-600">
              ₫{Number(selectedOrder.totalAmount || 0).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderInformation;
