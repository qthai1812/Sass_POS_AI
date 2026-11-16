import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  getOrdersByBranchPaged,
  getOrderById,
} from "@/Redux Toolkit/features/order/orderThunks";
import { findBranchEmployees } from "@/Redux Toolkit/features/employee/employeeThunks";
import { getPaymentIcon } from "../../../utils/getPaymentIcon";
import { getStatusColor } from "../../../utils/getStatusColor";
import { useToast } from "@/components/ui/use-toast";
import { handleDownloadOrderPDF } from "../../cashier/order/pdf/pdfUtils";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";
import { paymentModeMap, statusMap } from "./data";
import OrdersFilters from "./OrdersFilters";
import OrdersTable from "./OrdersTable";
import OrderDetailsDialog from "./OrderDetailsDialog";

const Orders = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const branchId = useSelector((state) => state.branch.branch?.id);
  const {
    pagedBranchOrders,
    pagedBranchLoading: loading,
    selectedOrder,
  } = useSelector((state) => state.order);
  const orders = pagedBranchOrders?.content || [];

  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    cashierId: "all",
    paymentMode: "all",
    status: "all",
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (branchId) {
      dispatch(findBranchEmployees({ branchId, role: "ROLE_CASHIER" }));
    }
  }, [branchId, dispatch]);

  const fetchPagedOrders = useCallback(() => {
    if (!branchId) return;
    dispatch(
      getOrdersByBranchPaged({
        branchId,
        cashierId: filters.cashierId !== "all" ? filters.cashierId : undefined,
        paymentType: paymentModeMap[filters.paymentMode],
        status: statusMap[filters.status],
        page,
        size: pageSize,
        sortBy,
        sortDir,
      })
    );
  }, [branchId, dispatch, filters, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    fetchPagedOrders();
  }, [fetchPagedOrders]);

  const handleFilterChange = (nextFilters) => {
    setFilters(nextFilters);
    setPage(0);
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(0);
  };

  const handleViewDetails = (orderId) => {
    dispatch(getOrderById(orderId));
    setShowDetails(true);
  };

  const handlePrintInvoice = async (orderId) => {
    const targetOrder = orders.find((o) => o.id === orderId) || selectedOrder;
    if (targetOrder) {
      await handleDownloadOrderPDF(targetOrder, toast);
    } else {
      const fetched = await dispatch(getOrderById(orderId)).unwrap();
      await handleDownloadOrderPDF(fetched, toast);
    }
  };

  const handleRefresh = () => {
    if (branchId) {
      fetchPagedOrders();
      toast({
        title: "Refreshed",
        description: "Branch orders list has been updated.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <OrdersFilters filters={filters} onFilterChange={handleFilterChange} />

      <div className="rounded-md border bg-card">
        <OrdersTable
          orders={orders}
          loading={loading}
          onViewDetails={handleViewDetails}
          onPrintInvoice={handlePrintInvoice}
          getStatusColor={getStatusColor}
          getPaymentIcon={getPaymentIcon}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        />
        <DataTablePagination
          page={pagedBranchOrders?.pageNumber ?? page}
          pageSize={pagedBranchOrders?.pageSize ?? pageSize}
          totalElements={pagedBranchOrders?.totalElements ?? 0}
          totalPages={pagedBranchOrders?.totalPages ?? 0}
          currentCount={orders.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          itemLabel="orders"
        />
      </div>

      <OrderDetailsDialog
        open={showDetails && !!selectedOrder}
        onOpenChange={setShowDetails}
        selectedOrder={selectedOrder}
        getStatusColor={getStatusColor}
        getPaymentIcon={getPaymentIcon}
      />
    </div>
  );
};

export default Orders;
