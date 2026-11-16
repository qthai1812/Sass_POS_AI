import React, { useEffect, useState } from "react";
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
import { getRefundsByBranchPaged } from "../../../Redux Toolkit/features/refund/refundThunks";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";
import { formatDate } from "../../cashier/order/data";

const Refunds = () => {
  const dispatch = useDispatch();
  const { branch } = useSelector((store) => store.branch);
  const { pagedBranchRefunds, pagedBranchLoading: loading } = useSelector(
    (store) => store.refund
  );
  const refunds = pagedBranchRefunds?.content || [];

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (branch?.id) {
      dispatch(
        getRefundsByBranchPaged({
          branchId: branch.id,
          page,
          size: pageSize,
          sortBy: "createdAt",
          sortDir: "desc",
        })
      );
    }
  }, [branch?.id, dispatch, page, pageSize]);

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(0);
  };

  return (
    <>
      <h1 className="font-bold text-2xl pb-5">Refunds</h1>
      <div className="rounded-md border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px]">ID</TableHead>
                <TableHead className="whitespace-nowrap">Order ID</TableHead>
                <TableHead className="whitespace-nowrap">Date &amp; Time</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Returned Items</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                <TableHead className="text-right pr-4">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-gray-400">
                    Loading refunds...
                  </TableCell>
                </TableRow>
              ) : refunds?.length > 0 ? (
                refunds.map((refund) => {
                  const items = Array.isArray(refund?.items) ? refund.items : [];
                  const cashierName =
                    refund?.cashierName || refund?.cashier?.fullName || "N/A";

                  return (
                    <TableRow key={refund?.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        #{refund.id}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        #ORD-{refund.orderId}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(refund.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cashierName}
                      </TableCell>
                      <TableCell>
                        {items.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
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
                      <TableCell className="whitespace-nowrap">
                        {refund.paymentType || "CASH"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 whitespace-nowrap">
                        -₫{Number(refund.amount ?? 0).toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell
                        className="text-right pr-4 max-w-[200px] truncate"
                        title={refund.reason || ""}
                      >
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
        </div>
        <DataTablePagination
          page={pagedBranchRefunds?.pageNumber ?? page}
          pageSize={pagedBranchRefunds?.pageSize ?? pageSize}
          totalElements={pagedBranchRefunds?.totalElements ?? 0}
          totalPages={pagedBranchRefunds?.totalPages ?? 0}
          currentCount={refunds.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          itemLabel="refunds"
        />
      </div>
    </>
  );
};

export default Refunds;
