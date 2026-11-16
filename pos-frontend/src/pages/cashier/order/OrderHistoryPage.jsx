import { useState, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SearchIcon,
  PrinterIcon,
  CalendarIcon,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import { getOrdersByCashierPaged } from "@/Redux Toolkit/features/order/orderThunks";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";
import { useSidebar } from "../../../context/hooks/useSidebar";
import OrderDetails from "./OrderDetails/OrderDetails";
import OrderTable from "./OrderTable";
import { handleDownloadOrderPDF, handlePrintOrderPDF } from "./pdf/pdfUtils";
import UserProfileMenu from "@/components/account/UserProfileMenu";

const toLocalIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const resolveDateBounds = (dateFilter, customDateRange) => {
  const now = new Date();
  const todayStr = toLocalIsoDate(now);
  if (dateFilter === "today") {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (dateFilter === "week") {
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay()
    );
    return { startDate: toLocalIsoDate(weekStart), endDate: todayStr };
  }
  if (dateFilter === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: toLocalIsoDate(monthStart), endDate: todayStr };
  }
  if (dateFilter === "custom") {
    return {
      startDate: customDateRange.start || undefined,
      endDate: customDateRange.end || undefined,
    };
  }
  return { startDate: undefined, endDate: undefined };
};

const OrderHistoryPage = () => {
  const { setSidebarOpen } = useSidebar();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const {
    pagedCashierOrders,
    pagedCashierLoading: loading,
    error,
  } = useSelector((state) => state.order);
  const orders = pagedCashierOrders?.content || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDateRange, setCustomDateRange] = useState({
    start: "",
    end: "",
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showOrderDetailsDialog, setShowOrderDetailsDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    const next = searchTerm.trim();
    if (next === debouncedSearch) return;
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  const dateBounds = useMemo(
    () => resolveDateBounds(dateFilter, customDateRange),
    [dateFilter, customDateRange]
  );

  const fetchPagedOrders = useCallback(() => {
    if (!userProfile?.id) return;
    dispatch(
      getOrdersByCashierPaged({
        cashierId: userProfile.id,
        keyword: debouncedSearch,
        startDate: dateBounds.startDate,
        endDate: dateBounds.endDate,
        page,
        size: pageSize,
        sortBy: "createdAt",
        sortDir: "desc",
      })
    );
  }, [
    dispatch,
    userProfile?.id,
    debouncedSearch,
    dateBounds.startDate,
    dateBounds.endDate,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetchPagedOrders();
  }, [fetchPagedOrders]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleDateFilterChange = (nextFilter) => {
    setDateFilter(nextFilter);
    setPage(0);
  };

  const handleCustomDateChange = (patch) => {
    setCustomDateRange((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(0);
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowOrderDetailsDialog(true);
  };

  const handlePrintInvoice = async (order) => {
    await handlePrintOrderPDF(order, toast);
  };

  const handleInitiateReturn = (order) => {
    const statusUpper = String(order?.status || "").toUpperCase();
    if (
      statusUpper === "REFUNDED" ||
      statusUpper === "CANCELLED" ||
      statusUpper === "PENDING"
    ) {
      toast({
        title: "Return Unavailable",
        description: `Order #${order.id} is ${statusUpper.toLowerCase()} and cannot be refunded.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Initiating Return",
      description: `Opening Return/Refund page for Order #${order.id}`,
    });
    navigate("/cashier/returns", { state: { selectedOrder: order } });
  };

  const handleDownloadPDF = async () => {
    await handleDownloadOrderPDF(selectedOrder, toast);
  };

  const handleRefreshOrders = () => {
    if (userProfile?.id) {
      fetchPagedOrders();
      toast({
        title: "Refreshing Orders",
        description: "Orders are being refreshed...",
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-card border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="z-10 p-2 h-10 w-10 rounded-lg shadow-sm border-border hover:bg-muted shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
          <h1 className="text-2xl font-bold">Order History</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefreshOrders}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <UserProfileMenu />
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by order ID, customer name, or phone..."
                className="pl-10"
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateFilter === "all" ? "default" : "outline"}
              onClick={() => handleDateFilterChange("all")}
            >
              All
            </Button>
            <Button
              variant={dateFilter === "today" ? "default" : "outline"}
              onClick={() => handleDateFilterChange("today")}
            >
              Today
            </Button>
            <Button
              variant={dateFilter === "week" ? "default" : "outline"}
              onClick={() => handleDateFilterChange("week")}
            >
              This Week
            </Button>
            <Button
              variant={dateFilter === "month" ? "default" : "outline"}
              onClick={() => handleDateFilterChange("month")}
            >
              This Month
            </Button>
            <Button
              variant={dateFilter === "custom" ? "default" : "outline"}
              onClick={() => handleDateFilterChange("custom")}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Custom
            </Button>
          </div>
        </div>

        {dateFilter === "custom" && (
          <div className="mt-4 flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={customDateRange.start}
                onChange={(e) =>
                  handleCustomDateChange({ start: e.target.value })
                }
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={customDateRange.end}
                onChange={(e) =>
                  handleCustomDateChange({ end: e.target.value })
                }
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setCustomDateRange({ start: "", end: "" });
                setPage(0);
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Loader2 className="animate-spin h-16 w-16 text-primary" />
            <p className="mt-4">Loading orders...</p>
          </div>
        ) : orders.length > 0 ? (
          <div className="rounded-md border bg-card">
            <OrderTable
              orders={orders}
              handleInitiateReturn={handleInitiateReturn}
              handlePrintInvoice={handlePrintInvoice}
              handleViewOrder={handleViewOrder}
            />
            <DataTablePagination
              page={pagedCashierOrders?.pageNumber ?? page}
              pageSize={pagedCashierOrders?.pageSize ?? pageSize}
              totalElements={pagedCashierOrders?.totalElements ?? 0}
              totalPages={pagedCashierOrders?.totalPages ?? 0}
              currentCount={orders.length}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              loading={loading}
              itemLabel="orders"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <SearchIcon size={48} strokeWidth={1} />
            <p className="mt-4">No orders found</p>
            <p className="text-sm">Try adjusting your search or date filters</p>
          </div>
        )}
      </div>

      <Dialog
        open={showOrderDetailsDialog}
        onOpenChange={setShowOrderDetailsDialog}
      >
        {selectedOrder && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Order Details - Invoice</DialogTitle>
            </DialogHeader>
            <OrderDetails selectedOrder={selectedOrder} />

            <DialogFooter className="gap-2 sm:gap-0 space-x-3">
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={() => handlePrintInvoice(selectedOrder)}>
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default OrderHistoryPage;
