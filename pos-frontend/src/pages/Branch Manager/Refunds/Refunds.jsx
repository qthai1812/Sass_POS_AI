import React, { useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDispatch, useSelector } from "react-redux";
import { getRefundsByBranch } from "../../../Redux Toolkit/features/refund/refundThunks";
import { formatDate } from "../../cashier/order/data";

const Refunds = () => {
  const dispatch = useDispatch();
  const { branch } = useSelector((store) => store.branch);
  const refunds = useSelector((store) => store.refund.refundsByBranch);

  useEffect(() => {
    if (branch?.id) dispatch(getRefundsByBranch(branch.id));
  }, [branch, dispatch]);

  return (
    <>
      <h1 className="font-bold text-2xl pb-5">Refunds</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">ID</TableHead>
            <TableHead>Order ID</TableHead>
            <TableHead>Date &amp; Time</TableHead>
            <TableHead>Cashier</TableHead>
            <TableHead>Returned Items</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {refunds?.length > 0 ? (
            refunds.map((refund) => {
              const items = Array.isArray(refund?.items) ? refund.items : [];
              const cashierName =
                refund?.cashierName || refund?.cashier?.fullName || "N/A";

              return (
                <TableRow key={refund?.id}>
                  <TableCell className="font-medium">#{refund.id}</TableCell>
                  <TableCell className="font-medium">
                    #ORD-{refund.orderId}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(refund.createdAt)}
                  </TableCell>
                  <TableCell>{cashierName}</TableCell>
                  <TableCell>
                    {items.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {items.map((item, idx) => (
                          <Badge
                            key={item.id || item.orderItemId || idx}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {item.productName || "Item"} ×{item.quantity}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Amount Refund
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{refund.paymentType || "CASH"}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    -₫{Number(refund.amount ?? 0).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right max-w-[220px] truncate">
                    {refund.reason || "—"}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                No refunds found matching your criteria
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
};

export default Refunds;
