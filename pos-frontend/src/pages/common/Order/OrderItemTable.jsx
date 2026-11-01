import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

const OrderItemTable = ({ selectedOrder }) => {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Image</TableHead>
            <TableHead className="min-w-[160px]">Item</TableHead>
            <TableHead className="text-center w-20">Qty</TableHead>
            <TableHead className="text-right w-28">Price</TableHead>
            <TableHead className="text-right w-28">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selectedOrder?.items?.map((item, idx) => {
            const unitPrice =
              item.product?.sellingPrice ??
              (item.price && item.quantity
                ? item.price / item.quantity
                : item.price) ??
              0;
            const lineTotal =
              item.price ?? unitPrice * Number(item.quantity || 1);

            return (
              <TableRow key={item.id || idx}>
                <TableCell>
                  <div className="w-10 h-10 shrink-0">
                    {item.product?.image ? (
                      <img
                        src={item.product.image}
                        alt={
                          item.productName || item.product?.name || "Product"
                        }
                        className="w-10 h-10 object-cover rounded-md border"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-md border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground font-semibold">
                          {(item.productName || item.product?.name || "P")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] sm:max-w-none">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm leading-snug break-words">
                      {item.product?.name || item.productName || "Product"}
                    </span>
                    {item.product?.sku && (
                      <span className="text-xs text-muted-foreground mt-0.5 break-all">
                        SKU: {item.product.sku}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center font-medium">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  ₫{Number(unitPrice || 0).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap">
                  ₫{Number(lineTotal || 0).toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default OrderItemTable;
