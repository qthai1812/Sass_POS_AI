import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ShoppingBag,
  Phone,
  Mail,
  User,
  Star,
  Plus,
  Award,
} from "lucide-react";
import { getStatusColor } from "../../../utils/getStatusColor";
import {
  getAllCustomers,
  updateCustomer,
} from "@/Redux Toolkit/features/customer/customerThunks";
import { getOrdersByCustomer } from "@/Redux Toolkit/features/order/orderThunks";
import { clearCustomerOrders } from "@/Redux Toolkit/features/order/orderSlice";
import { useToast } from "@/components/ui/use-toast";
import AddPointsDialog from "../../cashier/customer/components/AddPointsDialog";
import { getLoyaltyTier } from "../../cashier/customer/components/CustomerDetails";

const Customers = () => {
  const { customers = [], loading } = useSelector((state) => state.customer);
  const { customerOrders = [], loading: ordersLoading } = useSelector(
    (state) => state.order,
  );
  const dispatch = useDispatch();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState(0);

  useEffect(() => {
    dispatch(getAllCustomers());
  }, [dispatch]);

  const filteredCustomers = (customers || []).filter((customer) => {
    const q = searchTerm.toLowerCase();
    return (
      (customer.fullName?.toLowerCase() || "").includes(q) ||
      (customer.phone || "").includes(searchTerm) ||
      (customer.email?.toLowerCase() || "").includes(q)
    );
  });

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleOpenCustomerDialog = (customer) => {
    setSelectedCustomer(customer);
    setIsCustomerDialogOpen(true);
    dispatch(clearCustomerOrders());
    if (customer?.id) {
      dispatch(getOrdersByCustomer(customer.id));
    }
  };

  const handleAddPoints = async () => {
    if (!selectedCustomer || pointsToAdd <= 0) return;
    try {
      const currentPts = Number(selectedCustomer.loyaltyPoints || 0);
      const updated = await dispatch(
        updateCustomer({
          id: selectedCustomer.id,
          customer: {
            ...selectedCustomer,
            loyaltyPoints: currentPts + Number(pointsToAdd),
          },
        }),
      ).unwrap();
      setSelectedCustomer(updated);
      setShowAddPointsDialog(false);
      setPointsToAdd(0);
      toast({
        title: "Points Updated",
        description: `Đã cộng +${pointsToAdd} điểm cho ${updated.fullName} (Tổng: ${updated.loyaltyPoints} điểm)`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to update points",
        variant: "destructive",
      });
    }
  };

  // Thống kê chính xác từ dữ liệu thực tế
  const goldAndDiamondCount = customers.filter(
    (c) => Number(c.loyaltyPoints || 0) >= 100,
  ).length;
  const totalLoyaltyPoints = customers.reduce(
    (sum, c) => sum + Number(c.loyaltyPoints || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Customer Overview
        </h1>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name, phone, or email..."
              className="pl-9"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </CardContent>
      </Card>

      {/* Customer Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col items-center justify-center">
              <h3 className="text-base sm:text-lg font-medium text-muted-foreground">
                Total Customers
              </h3>
              <p className="text-2xl sm:text-3xl font-bold mt-2">
                {customers.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col items-center justify-center">
              <h3 className="text-base sm:text-lg font-medium text-muted-foreground">
                Gold & Diamond Members (≥100 pts)
              </h3>
              <p className="text-2xl sm:text-3xl font-bold mt-2 text-amber-500">
                {goldAndDiamondCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col items-center justify-center">
              <h3 className="text-base sm:text-lg font-medium text-muted-foreground">
                Total Loyalty Points Issued
              </h3>
              <p className="text-2xl sm:text-3xl font-bold mt-2 text-primary">
                {totalLoyaltyPoints.toLocaleString("vi-VN")} pts
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Customer List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0 overflow-x-auto">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">
              Loading customers...
            </div>
          ) : (
            <Table className="min-w-[680px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                  <TableHead className="text-center">Loyalty Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => {
                    const pts = Number(customer.loyaltyPoints || 0);
                    const tier = getLoyaltyTier(pts);
                    return (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          {customer.fullName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {customer.phone || "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {customer.email || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={tier.className}>
                            <Award className="w-3 h-3 mr-1" />
                            {tier.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 inline-flex items-center gap-1"
                          >
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {pts} pts ({(pts * 1000).toLocaleString("vi-VN")}₫)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCustomerDialog(customer)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No customers found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Dialog */}
      {selectedCustomer && (
        <Dialog
          open={isCustomerDialogOpen}
          onOpenChange={setIsCustomerDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl lg:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-xl font-bold">
                  Customer Details
                </DialogTitle>
                <Button
                  size="sm"
                  onClick={() => setShowAddPointsDialog(true)}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Points
                </Button>
              </div>
            </DialogHeader>

            <div className="space-y-5 flex-1 min-h-0 overflow-y-auto pr-1">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg font-semibold">
                    Profile & Loyalty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Name
                        </p>
                        <p className="text-sm sm:text-base font-medium break-words">
                          {selectedCustomer.fullName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 min-w-0">
                      <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Phone
                        </p>
                        <p className="text-sm sm:text-base">
                          {selectedCustomer.phone || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 min-w-0">
                      <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Email
                        </p>
                        <p className="text-sm sm:text-base break-all">
                          {selectedCustomer.email || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 min-w-0">
                      <Star className="h-5 w-5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Loyalty Points
                        </p>
                        <p className="text-sm sm:text-base font-bold text-amber-600">
                          {selectedCustomer.loyaltyPoints || 0} pts (
                          {(
                            Number(selectedCustomer.loyaltyPoints || 0) * 1000
                          ).toLocaleString("vi-VN")}
                          ₫)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 min-w-0">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          Total Orders
                        </p>
                        <p className="text-sm sm:text-base font-medium">
                          {customerOrders.length} orders
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order History */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg font-semibold">
                    Order History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0 overflow-x-auto">
                  {ordersLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading order history...
                    </div>
                  ) : customerOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No orders found for this customer.
                    </div>
                  ) : (
                    <Table className="w-full min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[90px]">Order ID</TableHead>
                          <TableHead className="w-[120px]">Amount</TableHead>
                          <TableHead className="min-w-[200px]">Items</TableHead>
                          <TableHead className="w-[100px]">Payment</TableHead>
                          <TableHead className="w-[120px] text-right">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              #{order.id}
                            </TableCell>
                            <TableCell className="font-semibold whitespace-nowrap">
                              ₫
                              {Number(order.totalAmount || 0).toLocaleString(
                                "vi-VN",
                              )}
                            </TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="text-xs sm:text-sm space-y-0.5">
                                {order.items?.slice(0, 2).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="truncate text-muted-foreground"
                                    title={item.product?.name}
                                  >
                                    • {item.product?.name} (x{item.quantity})
                                  </div>
                                ))}
                                {(order.items?.length || 0) > 2 && (
                                  <span className="text-xs text-primary font-medium">
                                    +{order.items.length - 2} more items
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline">
                                {order.paymentType || "CASH"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge
                                className={getStatusColor(
                                  order.status || "COMPLETED",
                                )}
                                variant="secondary"
                              >
                                {order.status || "COMPLETED"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
    </div>
  );
};

export default Customers;
