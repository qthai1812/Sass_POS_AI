import React, { useState, useEffect } from "react";
import { useLocation } from "react-router";
import {
  OrderDetailsSection,
  ReturnItemsSection,
  ReturnReceiptDialog,
} from "./components";
import { useDispatch, useSelector } from "react-redux";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";
import { getRefundsByBranch } from "../../../Redux Toolkit/features/refund/refundThunks";
import OrderTable from "./components/OrderTable";

const ReturnOrderPage = () => {
  const location = useLocation();
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
  });

  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);

  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id;

  useEffect(() => {
    if (resolvedBranchId) {
      dispatch(getOrdersByBranch({ branchId: resolvedBranchId }));
      dispatch(getRefundsByBranch(resolvedBranchId));
    }
  }, [dispatch, resolvedBranchId]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-card border-b">
        <h1 className="text-2xl font-bold">Return / Refund</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedOrder ? (
          <OrderTable handleSelectOrder={handleSelectOrder} />
        ) : (
          <>
            <OrderDetailsSection
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
            />
            <ReturnItemsSection
              setShowReceiptDialog={setShowReceiptDialog}
              selectedOrder={selectedOrder}
              onRefundSuccess={(info) => setLastRefundInfo(info)}
            />
          </>
        )}
      </div>

      {selectedOrder && (
        <ReturnReceiptDialog
          showReceiptDialog={showReceiptDialog}
          setShowReceiptDialog={(open) => {
            setShowReceiptDialog(open);
            if (!open) setSelectedOrder(null);
          }}
          selectedOrder={selectedOrder}
          refundId={lastRefundInfo.id}
          returnReason={lastRefundInfo.reason}
          refundMethod={lastRefundInfo.refundMethod}
          refundAmount={lastRefundInfo.amount}
          returnedItems={lastRefundInfo.items}
        />
      )}
    </div>
  );
};

export default ReturnOrderPage;
