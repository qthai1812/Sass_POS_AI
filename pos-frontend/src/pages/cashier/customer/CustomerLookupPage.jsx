import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useSidebar } from "../../../context/hooks/useSidebar";
import { getAllCustomers } from "@/Redux Toolkit/features/customer/customerThunks";
import { getOrdersByCustomer } from "@/Redux Toolkit/features/order/orderThunks";
import {
  filterCustomers,
  calculateCustomerStats,
} from "./utils/customerUtils";
import {
  CustomerSearch,
  CustomerList,
  CustomerDetails,
  PurchaseHistory,
} from "./components";
import { clearCustomerOrders } from "../../../Redux Toolkit/features/order/orderSlice";
import CustomerForm from "./CustomerForm";
import UserProfileMenu from "@/components/account/UserProfileMenu";

const CustomerLookupPage = () => {
  const { setSidebarOpen } = useSidebar();
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

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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
      <div className="p-4 bg-card border-b flex items-center justify-between gap-3">
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
          <h1 className="text-2xl font-bold">Customer Management</h1>
        </div>
        <UserProfileMenu />
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
            loading={orderLoading}
          />
          {selectedCustomer && (
            <PurchaseHistory orders={customerOrders} loading={orderLoading} />
          )}
        </div>
      </div>

      <CustomerForm
        showCustomerForm={showCustomerForm}
        setShowCustomerForm={setShowCustomerForm}
        onCustomerCreated={handleSelectCustomer}
      />
    </div>
  );
};

export default CustomerLookupPage;
