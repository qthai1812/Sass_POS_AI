import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import { useSelector } from "react-redux";

const OrdersFilters = ({
  filters = { cashierId: "all", paymentMode: "all", status: "all" },
  onFilterChange,
}) => {
  const { employees } = useSelector((state) => state.employee);

  const handleUpdate = (updatedFilters) => {
    onFilterChange?.(updatedFilters);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Payment Mode Filter */}
      <div>
        <Select
          value={filters.paymentMode}
          onValueChange={(value) =>
            handleUpdate({ ...filters, paymentMode: value })
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
            handleUpdate({ ...filters, cashierId: value })
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
            handleUpdate({ ...filters, status: value })
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
            <SelectItem value="PartiallyRefunded">Partially Refunded</SelectItem>
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
