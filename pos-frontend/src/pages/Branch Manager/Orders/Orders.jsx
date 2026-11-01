import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  getOrdersByBranch,
  getOrderById,
} from "@/Redux Toolkit/features/order/orderThunks";
import { findBranchEmployees } from "@/Redux Toolkit/features/employee/employeeThunks";
import { getPaymentIcon } from "../../../utils/getPaymentIcon";
import { getStatusColor } from "../../../utils/getStatusColor";
import { useToast } from "@/components/ui/use-toast";
import { handleDownloadOrderPDF } from "../../cashier/order/pdf/pdfUtils";
import OrdersFilters from "./OrdersFilters";
import OrdersTable from "./OrdersTable";
import OrderDetailsDialog from "./OrderDetailsDialog";

const Orders = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const branchId = useSelector((state) => state.branch.branch?.id);
  const { orders = [], loading, selectedOrder } = useSelector((state) => state.order);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (branchId) {
      dispatch(findBranchEmployees({ branchId, role: "ROLE_BRANCH_CASHIER" }));
    }
  }, [branchId, dispatch]);

  useEffect(() => {
    if (branchId) {
      dispatch(getOrdersByBranch({ branchId }));
    }
  }, [branchId, dispatch]);

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
      dispatch(getOrdersByBranch({ branchId }));
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

      <OrdersFilters />

      <OrdersTable
        orders={orders}
        loading={loading}
        onViewDetails={handleViewDetails}
        onPrintInvoice={handlePrintInvoice}
        getStatusColor={getStatusColor}
        getPaymentIcon={getPaymentIcon}
      />

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
