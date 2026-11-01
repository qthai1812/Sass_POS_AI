import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { paymentModeMap, statusMap } from "./data";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";

const OrdersFilters = () => {
  const dispatch = useDispatch();
  const branchId = useSelector((state) => state.branch.branch?.id);
  const { employees } = useSelector((state) => state.employee);

  const [filters, setFilters] = useState({
    cashierId: "all",
    paymentMode: "all",
    status: "all",
  });

  const handleFilterChange = (updatedFilters) => {
    setFilters(updatedFilters);
    if (branchId) {
      const data = {
        branchId,
        cashierId:
          updatedFilters.cashierId !== "all"
            ? updatedFilters.cashierId
            : undefined,
        paymentType: paymentModeMap[updatedFilters.paymentMode],
        status: statusMap[updatedFilters.status],
      };
      dispatch(getOrdersByBranch(data));
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Payment Mode Filter */}
      <div>
        <Select
          value={filters.paymentMode}
          onValueChange={(value) =>
            handleFilterChange({ ...filters, paymentMode: value })
          }
        >
          <SelectTrigger
            startIcon={<Filter className="h-4 w-4 text-gray-500" />}
            className="w-full"
          >
            <SelectValue placeholder="All Payment Modes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment Modes</SelectItem>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="UPI">UPI</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Cashier Filter */}
      <div>
        <Select
          value={filters.cashierId}
          onValueChange={(value) =>
            handleFilterChange({ ...filters, cashierId: value })
          }
        >
          <SelectTrigger
            startIcon={<Filter className="h-4 w-4 text-gray-500" />}
            className="w-full"
          >
            <SelectValue placeholder="All Cashiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cashiers</SelectItem>
            {employees &&
              employees.map((emp) => (
                <SelectItem key={emp.id} value={String(emp.id)}>
                  {emp.fullName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {/* Status Filter */}
      <div>
        <Select
          value={filters.status}
          onValueChange={(value) =>
            handleFilterChange({ ...filters, status: value })
          }
        >
          <SelectTrigger
            startIcon={<Filter className="h-4 w-4 text-gray-500" />}
            className="w-full"
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
            <SelectItem value="Refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default OrdersFilters;
