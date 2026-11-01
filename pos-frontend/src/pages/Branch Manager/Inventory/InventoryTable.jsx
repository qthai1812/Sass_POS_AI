import React from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Edit, AlertTriangle } from "lucide-react";

const InventoryTable = ({ rows, inventories, onEdit }) => {
  const dataList = Array.isArray(rows)
    ? rows
    : Array.isArray(inventories)
      ? inventories
      : [];

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="w-full min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">SKU</TableHead>
              <TableHead className="min-w-[220px]">Product Name</TableHead>
              <TableHead className="w-[160px]">Category</TableHead>
              <TableHead className="text-center w-[110px]">Quantity</TableHead>
              <TableHead className="text-center w-[130px]">
                Stock Status
              </TableHead>
              <TableHead className="text-right w-[90px] pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  No inventory records found matching your filter.
                </TableCell>
              </TableRow>
            ) : (
              dataList.map((row) => {
                const qty = Number(row?.quantity ?? 0);
                const minStock = Number(row?.minStockLevel ?? 10);
                const isOut = qty <= 0;
                const isLow = qty > 0 && qty <= minStock;
                const categoryLabel =
                  typeof row?.category === "object"
                    ? row.category?.name
                    : row?.category ||
                      row?.product?.category?.name ||
                      "Chưa phân loại";

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {row.sku || row.product?.sku || `SKU-${row.productId}`}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm leading-snug">
                        {row.name || row.product?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {row.productId ?? row.product?.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {categoryLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {qty}
                        </span>
                      ) : (
                        qty
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isOut ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : isLow ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300">
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300">
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit && onEdit(row)}
                      >
                        <Edit className="h-4 w-4" />
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

export default InventoryTable;
