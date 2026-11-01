import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDispatch, useSelector } from "react-redux";
import { getAllCustomers } from "@/Redux Toolkit/features/customer/customerThunks";
import CustomerForm from "./CustomerForm";
import { setSelectedCustomer } from "../../../Redux Toolkit/features/cart/cartSlice";
import { Search, UserPlus, Check, Star } from "lucide-react";

const CustomerDialog = ({ showCustomerDialog, setShowCustomerDialog }) => {
  const dispatch = useDispatch();
  const { customers, loading } = useSelector((state) => state.customer);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);

  useEffect(() => {
    if (showCustomerDialog) {
      dispatch(getAllCustomers());
    }
  }, [showCustomerDialog, dispatch]);

  const filteredCustomers = (customers || []).filter(
    (customer) =>
      customer.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm),
  );

  const handleSelectCustomer = (customer) => {
    dispatch(setSelectedCustomer(customer));
    setShowCustomerDialog(false);
  };

  return (
    <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Select Customer
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading customers...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {searchTerm
                ? "No customers found matching your search."
                : "No customers available."}
            </div>
          ) : (
            <Table className="w-full table-fixed sm:table-auto">
              <TableHeader className="sticky top-0 bg-card z-10 shadow-xs">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-center">Loyalty Points</TableHead>
                  <TableHead className="w-[100px] text-right pr-3">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const pts = Number(customer.loyaltyPoints || 0);
                  return (
                    <TableRow key={customer.id} className="hover:bg-muted/50">
                      <TableCell className="py-2.5">
                        <div className="font-medium truncate">
                          {customer.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate md:hidden">
                          {customer.email || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm whitespace-nowrap">
                        {customer.phone || "-"}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                        {customer.email || "-"}
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        >
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {pts} pts ({(pts * 1000).toLocaleString("vi-VN")}₫)
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right pr-3">
                        <Button
                          size="sm"
                          className="shrink-0 whitespace-nowrap px-3"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <CustomerForm
          showCustomerForm={showAddCustomerForm}
          setShowCustomerForm={setShowAddCustomerForm}
        />

        <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCustomerDialog(false)}
          >
            Cancel
          </Button>
          <Button onClick={() => setShowAddCustomerForm(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;
