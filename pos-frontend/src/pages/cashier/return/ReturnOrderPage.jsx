import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  OrderDetailsSection,
  ReturnItemsSection,
  ReturnReceiptDialog,
} from "./components";
import { useDispatch, useSelector } from "react-redux";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";
import {
  getRefundsByBranch,
  getRefundsByOrder,
} from "../../../Redux Toolkit/features/refund/refundThunks";
import { clearRefundsByOrder } from "../../../Redux Toolkit/features/refund/refundSlice";
import { getCurrentShiftProgress } from "../../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import { useSidebar } from "../../../context/hooks/useSidebar";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import OrderTable from "./components/OrderTable";
import UserProfileMenu from "@/components/account/UserProfileMenu";

const ReturnOrderPage = () => {
  const { setSidebarOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState(
    location.state?.selectedOrder || null,
  );
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastRefundInfo, setLastRefundInfo] = useState({
    id: null,
    reason: "",
    refundMethod: "",
    amount: null,
    items: [],
    refundMode: "ITEMS",
    isOrderFullyRefunded: false,
  });

  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { orders = [] } = useSelector((state) => state.order);
  const { currentShift, loading: shiftLoading } = useSelector(
    (state) => state.shiftReport,
  );

  const [shiftChecked, setShiftChecked] = useState(false);

  const isCashier = userProfile?.role === "ROLE_CASHIER";
  const hasActiveShift = Boolean(currentShift?.id && !currentShift?.shiftEnd);

  const resolvedBranchId =
    branch?.id ||
    userProfile?.branchId ||
    userProfile?.branch?.id ||
    selectedOrder?.branchId;

  // Keep selectedOrder synchronized with updated orders list from Redux (e.g. COMPLETED -> PARTIALLY_REFUNDED -> REFUNDED)
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;
    const latestFromList = (orders || []).find(
      (o) => Number(o?.id) === Number(selectedOrder.id),
    );
    return latestFromList || selectedOrder;
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (resolvedBranchId) {
      dispatch(getOrdersByBranch({ branchId: resolvedBranchId }));
      dispatch(getRefundsByBranch(resolvedBranchId));
    }
  }, [dispatch, resolvedBranchId]);

  useEffect(() => {
    if (!isCashier) {
      setShiftChecked(true);
      return;
    }
    let mounted = true;
    dispatch(getCurrentShiftProgress()).finally(() => {
      if (mounted) setShiftChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [dispatch, isCashier]);

  useEffect(() => {
    if (selectedOrder?.id) {
      dispatch(getRefundsByOrder(selectedOrder.id));
    } else {
      dispatch(clearRefundsByOrder());
    }
  }, [dispatch, selectedOrder?.id]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-card border-b flex items-center justify-between gap-3 shrink-0">
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
          <h1 className="text-2xl font-bold">Return / Refund</h1>
        </div>
        <UserProfileMenu />
      </div>

      {isCashier && shiftChecked && !shiftLoading && !hasActiveShift && (
        <div className="px-4 pt-3 shrink-0">
          <Alert className="border-amber-500/50 bg-amber-50/70 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <AlertTitle>Chưa bắt đầu ca làm việc (Shift)</AlertTitle>
                <AlertDescription className="text-amber-800/90 dark:text-amber-200/90">
                  Thu ngân cần mở ca làm việc trước khi tạo phiếu hoàn tiền. Vui
                  lòng nhấn <strong>Start Shift</strong> tại trang Shift Summary.
                </AlertDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-500/60 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              onClick={() => navigate("/cashier/shift-summary")}
            >
              Go to Shift Summary
            </Button>
          </Alert>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {!activeSelectedOrder ? (
          <OrderTable handleSelectOrder={handleSelectOrder} />
        ) : (
          <>
            <OrderDetailsSection
              selectedOrder={activeSelectedOrder}
              setSelectedOrder={setSelectedOrder}
            />
            <ReturnItemsSection
              setShowReceiptDialog={setShowReceiptDialog}
              selectedOrder={activeSelectedOrder}
              resolvedBranchId={resolvedBranchId}
              isCashier={isCashier}
              hasActiveShift={hasActiveShift}
              onRefundSuccess={(info) => setLastRefundInfo(info)}
            />
          </>
        )}
      </div>

      {activeSelectedOrder && (
        <ReturnReceiptDialog
          showReceiptDialog={showReceiptDialog}
          setShowReceiptDialog={(open) => {
            setShowReceiptDialog(open);
            if (!open) {
              const currentStatus = String(
                activeSelectedOrder?.status || "",
              ).toUpperCase();
              if (
                lastRefundInfo.isOrderFullyRefunded ||
                currentStatus === "REFUNDED"
              ) {
                setSelectedOrder(null);
              }
            }
          }}
          selectedOrder={activeSelectedOrder}
          refundId={lastRefundInfo.id}
          returnReason={lastRefundInfo.reason}
          refundMethod={lastRefundInfo.refundMethod}
          refundAmount={lastRefundInfo.amount}
          returnedItems={lastRefundInfo.items}
          refundMode={lastRefundInfo.refundMode}
        />
      )}
    </div>
  );
};

export default ReturnOrderPage;
