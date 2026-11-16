import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchIcon } from "lucide-react";
import { formatDate } from "../../order/data";
import { useDispatch, useSelector } from "react-redux";
import { getOrdersByBranchPaged } from "@/Redux Toolkit/features/order/orderThunks";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";

const OrderTable = ({
  branchId,
  handleSelectOrder,
  searchQuery = "",
  onSearchQueryChange,
  page = 0,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageSizeChange,
  refreshKey = 0,
}) => {
  const dispatch = useDispatch();
  const {
    pagedBranchOrders,
    pagedBranchLoading: loading,
    error,
  } = useSelector((state) => state.order);
  const { refundsByBranch = [] } = useSelector((state) => state.refund);

  const initialTrimmedSearch = String(searchQuery || "").trim();
  const [debouncedSearch, setDebouncedSearch] = useState(initialTrimmedSearch);
  const debouncedSearchRef = useRef(initialTrimmedSearch);
  const debounceTimerRef = useRef(null);

  const orders = pagedBranchOrders?.content || [];

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!branchId) return;
    dispatch(
      getOrdersByBranchPaged({
        branchId,
        keyword: debouncedSearch,
        page,
        size: pageSize,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
    );
  }, [dispatch, branchId, debouncedSearch, page, pageSize, refreshKey]);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    onSearchQueryChange?.(val);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const next = val.trim();
      if (debouncedSearchRef.current !== next) {
        debouncedSearchRef.current = next;
        setDebouncedSearch(next);
        onPageChange?.(0);
      }
    }, 350);
  };

  const refundedAmountByOrderId = useMemo(() => {
    const map = new Map();
    for (const r of refundsByBranch || []) {
      if (r?.orderId != null) {
        map.set(
          r.orderId,
          (map.get(r.orderId) || 0) + Number(r.amount || 0),
        );
      }
    }
    return map;
  }, [refundsByBranch]);

  return (
    <div className="w-full p-4 flex flex-col min-h-0 flex-1">
      <div className="mb-4 max-w-md relative shrink-0">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by Order ID, customer name, or payment mode..."
          className="pl-9"
          value={searchQuery}
          onChange={handleSearchInputChange}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <span>Loading orders...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
            <span>{error}</span>
          </div>
        ) : orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusUpper = String(order.status || "").toUpperCase();
                const orderTotal = Number(order.totalAmount || 0);
                const refundedSoFar = Number(
                  order.refundedAmount ??
                    refundedAmountByOrderId.get(order.id) ??
                    0,
                );
                const isFullyRefunded =
                  statusUpper === "REFUNDED" ||
                  (orderTotal > 0 && refundedSoFar >= orderTotal - 0.01);
                const isPartiallyRefunded =
                  statusUpper === "PARTIALLY_REFUNDED" ||
                  (!isFullyRefunded && refundedSoFar > 0);
                const isCancelled = statusUpper === "CANCELLED";
                const isPending = statusUpper === "PENDING";

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>#{order.id}</span>
                        {isPartiallyRefunded && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/40 text-amber-600"
                          >
                            Partial Refund
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      {order.customer?.fullName || "Walk-in Customer"}
                    </TableCell>
                    <TableCell>
                      <div>
                        ₫{orderTotal.toLocaleString("vi-VN")}
                      </div>
                      {isPartiallyRefunded && (
                        <div className="text-xs text-muted-foreground">
                          Remaining: ₫
                          {Math.max(
                            0,
                            orderTotal - refundedSoFar,
                          ).toLocaleString("vi-VN")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{order.paymentType || "CASH"}</TableCell>
                    <TableCell className="text-right">
                      {isFullyRefunded ? (
                        <Button disabled variant="secondary">
                          Refunded
                        </Button>
                      ) : isCancelled ? (
                        <Button disabled variant="secondary">
                          Cancelled
                        </Button>
                      ) : isPending ? (
                        <Button disabled variant="secondary">
                          Pending
                        </Button>
                      ) : (
                        <Button
                          variant={isPartiallyRefunded ? "outline" : "default"}
                          onClick={() => handleSelectOrder(order)}
                        >
                          {isPartiallyRefunded
                            ? "Return Remaining"
                            : "Select for Return"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <SearchIcon size={48} strokeWidth={1} />
            <p className="mt-4">No orders found</p>
            <p className="text-sm">
              Try searching by order ID or customer name
            </p>
          </div>
        )}
      </div>

      <DataTablePagination
        page={pagedBranchOrders?.pageNumber ?? page}
        pageSize={pagedBranchOrders?.pageSize ?? pageSize}
        totalElements={pagedBranchOrders?.totalElements ?? 0}
        totalPages={pagedBranchOrders?.totalPages ?? 0}
        currentCount={orders.length}
        onPageChange={(nextPage) => onPageChange?.(nextPage)}
        onPageSizeChange={(nextSize) => onPageSizeChange?.(nextSize)}
        loading={loading}
        itemLabel="đơn hàng"
        className="shrink-0 mt-3 pt-3 border-t"
      />
    </div>
  );
};

export default OrderTable;
