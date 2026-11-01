import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/components/ui/use-toast";
import {
  getAllCustomers,
  updateCustomer,
} from "@/Redux Toolkit/features/customer/customerThunks";
import { getOrdersByCustomer } from "@/Redux Toolkit/features/order/orderThunks";
import {
  filterCustomers,
  validatePoints,
  calculateCustomerStats,
} from "./utils/customerUtils";
import {
  CustomerSearch,
  CustomerList,
  CustomerDetails,
  PurchaseHistory,
  AddPointsDialog,
} from "./components";
import { clearCustomerOrders } from "../../../Redux Toolkit/features/order/orderSlice";
import {
  selectSelectedCustomer,
  setSelectedCustomer as setCartSelectedCustomer,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import CustomerForm from "./CustomerForm";

const CustomerLookupPage = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const {
    customers,
    loading: customerLoading,
    error: customerError,
  } = useSelector((state) => state.customer);
  const {
    customerOrders,
    loading: orderLoading,
    error: orderError,
  } = useSelector((state) => state.order);
  const cartCustomer = useSelector(selectSelectedCustomer);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState(0);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  useEffect(() => {
    dispatch(getAllCustomers());
  }, [dispatch]);

  useEffect(() => {
    if (customerError) {
      toast({
        title: "Error",
        description: customerError,
        variant: "destructive",
      });
    }
  }, [customerError, toast]);

  useEffect(() => {
    if (orderError) {
      toast({
        title: "Error",
        description: orderError,
        variant: "destructive",
      });
    }
  }, [orderError, toast]);

  const filteredCustomers = filterCustomers(customers, searchTerm);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    dispatch(clearCustomerOrders());
    if (customer?.id) {
      dispatch(getOrdersByCustomer(customer.id));
    }
  };

  const handleAddPoints = async () => {
    const error = validatePoints(pointsToAdd);
    if (error) {
      toast({
        title: "Invalid Points",
        description: error,
        variant: "destructive",
      });
      return;
    }

    try {
      const currentPts = Number(selectedCustomer?.loyaltyPoints || 0);
      const newPoints = currentPts + Number(pointsToAdd);

      const updated = await dispatch(
        updateCustomer({
          id: selectedCustomer.id,
          customer: {
            ...selectedCustomer,
            loyaltyPoints: newPoints,
          },
        }),
      ).unwrap();

      setSelectedCustomer(updated);
      // Đồng bộ luôn với giỏ hàng nếu khách hàng này đang được chọn trong POS
      if (cartCustomer && cartCustomer.id === updated.id) {
        dispatch(setCartSelectedCustomer(updated));
      }

      toast({
        title: "Points Added",
        description: `Đã cộng +${pointsToAdd} điểm cho ${
          updated.fullName || updated.name
        } (Tổng: ${updated.loyaltyPoints ?? newPoints} điểm)`,
      });
      setShowAddPointsDialog(false);
      setPointsToAdd(0);
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to update customer points",
        variant: "destructive",
      });
    }
  };

  const customerStats = selectedCustomer
    ? calculateCustomerStats(customerOrders)
    : null;

  const displayCustomer = selectedCustomer
    ? {
        ...selectedCustomer,
        ...customerStats,
      }
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-card border-b">
        <h1 className="text-2xl font-bold">Customer Management</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r flex flex-col">
          <CustomerSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onAddCustomer={() => setShowCustomerForm(true)}
          />
          <CustomerList
            customers={filteredCustomers}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
            loading={customerLoading}
          />
        </div>

        <div className="w-2/3 flex flex-col overflow-y-auto">
          <CustomerDetails
            customer={displayCustomer}
            onAddPoints={() => setShowAddPointsDialog(true)}
            loading={orderLoading}
          />
          {selectedCustomer && (
            <PurchaseHistory orders={customerOrders} loading={orderLoading} />
          )}
        </div>
      </div>

      <AddPointsDialog
        isOpen={showAddPointsDialog}
        onClose={() => {
          setShowAddPointsDialog(false);
          setPointsToAdd(0);
        }}
        customer={selectedCustomer}
        pointsToAdd={pointsToAdd}
        onPointsChange={setPointsToAdd}
        onAddPoints={handleAddPoints}
      />

      <CustomerForm
        showCustomerForm={showCustomerForm}
        setShowCustomerForm={setShowCustomerForm}
        onCustomerCreated={handleSelectCustomer}
      />
    </div>
  );
};

export default CustomerLookupPage;
