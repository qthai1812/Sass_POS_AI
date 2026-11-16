import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { DollarSign, Edit, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "../../components/ui/use-toast";
import {
  getAllStoresPaged,
  getStoreSummary,
  updateStore,
} from "../../Redux Toolkit/features/store/storeThunks";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";

export default function CommissionsPage() {
  const dispatch = useDispatch();
  const { pagedStores, pagedLoading: loading, storeSummary } = useSelector(
    (state) => state.store
  );
  const stores = useMemo(() => pagedStores?.content || [], [pagedStores?.content]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rateOverrides, setRateOverrides] = useState({});
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newRate, setNewRate] = useState("");
  const { toast } = useToast();

  const fetchCommissionsPage = useCallback(() => {
    dispatch(
      getAllStoresPaged({
        page,
        size: pageSize,
        sortBy: "createdAt",
        sortDir: "desc",
      })
    );
  }, [dispatch, page, pageSize]);

  useEffect(() => {
    fetchCommissionsPage();
  }, [fetchCommissionsPage]);

  useEffect(() => {
    dispatch(getStoreSummary());
  }, [dispatch]);

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(0);
  };

  const commissions = useMemo(() => {
    return (stores || []).map((store) => {
      const override = rateOverrides[store.id];
      const currentRate =
        override?.currentRate ?? store.commissionRate ?? 2.5;
      const previousRate =
        override?.previousRate ?? store.commissionRate ?? 2.5;
      const lastUpdated =
        override?.lastUpdated ||
        (store.updatedAt || store.createdAt || new Date().toISOString()).split(
          "T",
        )[0];
      return {
        id: store.id,
        storeName: store.brand || `Store #${store.id}`,
        currentRate: Number(currentRate),
        previousRate: Number(previousRate),
        totalEarnings: Number(store.totalEarnings ?? 0),
        lastUpdated,
        status: String(store.status || "PENDING").toUpperCase(),
        rawStore: store,
      };
    });
  }, [stores, rateOverrides]);

  const totalEarnings = Number(storeSummary?.totalEarnings ?? 0);
  const averageRate = Number(storeSummary?.averageCommissionRate ?? 0).toFixed(1);
  const activeStoresCount = Number(storeSummary?.activeStores ?? 0);
  const totalStoresCount = Number(storeSummary?.totalStores ?? 0);

  const handleEditCommission = (commission) => {
    setSelectedCommission(commission);
    setNewRate(commission.currentRate.toString());
    setEditDialogOpen(true);
  };

  const confirmEditCommission = async () => {
    if (selectedCommission && newRate !== "") {
      const rate = parseFloat(newRate);
      if (isNaN(rate) || rate < 0 || rate > 10) {
        toast({
          title: "Invalid Rate",
          description: "Commission rate must be between 0% and 10%",
          variant: "destructive",
        });
        return;
      }

      try {
        await dispatch(
          updateStore({
            id: selectedCommission.id,
            storeData: {
              commissionRate: rate,
            },
          }),
        ).unwrap();

        setRateOverrides((prev) => ({
          ...prev,
          [selectedCommission.id]: {
            previousRate: selectedCommission.currentRate,
            currentRate: rate,
            lastUpdated: new Date().toISOString().split("T")[0],
          },
        }));

        toast({
          title: "Commission Updated",
          description: `Commission rate for ${selectedCommission.storeName} has been updated to ${rate}%`,
        });
        dispatch(getStoreSummary());
        fetchCommissionsPage();

        setEditDialogOpen(false);
        setSelectedCommission(null);
        setNewRate("");
      } catch (err) {
        toast({
          title: "Update Failed",
          description:
            typeof err === "string"
              ? err
              : "Failed to update store commission rate",
          variant: "destructive",
        });
      }
    }
  };

  const getRateChange = (current, previous) => {
    const change = Number((current - previous).toFixed(2));
    if (change > 0) {
      return {
        value: `+${change}%`,
        className: "text-green-600",
        icon: <TrendingUp className="w-3 h-3" />,
      };
    } else if (change < 0) {
      return {
        value: `${change}%`,
        className: "text-red-600",
        icon: <TrendingDown className="w-3 h-3" />,
      };
    } else {
      return { value: "0%", className: "text-muted-foreground", icon: null };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Commissions</h2>
        <p className="text-muted-foreground">
          Manage commission rates for all stores
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Earnings
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₫{totalEarnings.toLocaleString("vi-VN")}
            </div>
            <p className="text-xs text-muted-foreground">
              Aggregated commission across all stores
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRate}%</div>
            <p className="text-xs text-muted-foreground">
              Platform-wide average commission rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStoresCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalStoresCount} total registered store(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commission Table */}
      <Card>
        <CardHeader>
          <CardTitle>Store Commission Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table className="min-w-[780px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Rate</TableHead>
                  <TableHead>Rate Change</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {loading
                        ? "Loading store commissions..."
                        : "No stores registered yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  commissions.map((commission) => {
                    const rateChange = getRateChange(
                      commission.currentRate,
                      commission.previousRate,
                    );
                    return (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">
                          {commission.storeName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              commission.status === "ACTIVE"
                                ? "default"
                                : commission.status === "BLOCKED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {commission.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-sm">
                            {commission.currentRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div
                            className={`flex items-center gap-1 ${rateChange.className}`}
                          >
                            {rateChange.icon}
                            <span className="text-sm">{rateChange.value}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          ₫{commission.totalEarnings.toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{commission.lastUpdated}</TableCell>
                        <TableCell className="text-right whitespace-nowrap pr-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCommission(commission)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit Rate
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination
            page={pagedStores?.pageNumber ?? page}
            pageSize={pagedStores?.pageSize ?? pageSize}
            totalElements={pagedStores?.totalElements ?? 0}
            totalPages={pagedStores?.totalPages ?? 0}
            currentCount={commissions.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            loading={loading}
            itemLabel="stores"
            className="mt-3"
          />
        </CardContent>
      </Card>

      {/* Edit Commission Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Commission Rate</DialogTitle>
            <DialogDescription>
              Update the commission rate for {selectedCommission?.storeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-rate">Current Rate</Label>
              <div className="text-sm text-muted-foreground">
                {selectedCommission?.currentRate}%
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-rate">New Rate (%)</Label>
              <Input
                id="new-rate"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="Enter new commission rate"
              />
              <p className="text-xs text-muted-foreground">
                Rate must be between 0% and 10%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEditCommission}>
              <Edit className="w-4 h-4 mr-2" />
              Update Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
