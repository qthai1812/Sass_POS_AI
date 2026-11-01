import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Eye, MoreHorizontal, Ban, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import StoreStatusBadge from "./StoreStatusBadge";
import {
  getAllStores,
  moderateStore,
} from "../../../Redux Toolkit/features/store/storeThunks";
import { formatDateTime } from "../../../utils/formateDate";
import { toast as sonnerToast } from "sonner";

export default function StoreTable({
  onViewDetails,
  onBlockStore,
  onActivateStore,
}) {
  const dispatch = useDispatch();
  const { stores = [], loading, error } = useSelector((state) => state.store);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    dispatch(
      getAllStores(
        statusFilter === "all" ? undefined : statusFilter.toUpperCase()
      )
    );
  }, [dispatch, statusFilter]);

  // Client-side search across brand, storeAdmin.fullName, and contact.email
  const filteredStores = (stores || []).filter((store) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      (store.brand?.toLowerCase() || "").includes(query) ||
      (store.storeAdmin?.fullName?.toLowerCase() || "").includes(query) ||
      (store.contact?.email?.toLowerCase() || "").includes(query) ||
      (store.contact?.phone || "").includes(query);
    return matchesSearch;
  });

  const handleStatusChange = async (storeId, newStatus) => {
    setUpdatingId(storeId);
    try {
      const updated = await dispatch(
        moderateStore({ storeId, action: newStatus })
      ).unwrap();
      const brandName = updated?.brand || "Store";
      if (newStatus === "ACTIVE") {
        sonnerToast.success(
          `${brandName} is now ACTIVE. Store Admin, Branch Managers, and Cashiers can access the system.`
        );
      } else if (newStatus === "PENDING") {
        sonnerToast.info(
          `${brandName} is now PENDING. All store and branch accounts are waiting for approval.`
        );
      } else if (newStatus === "BLOCKED") {
        sonnerToast.warning(
          `${brandName} has been BLOCKED. All store and branch accounts are now suspended.`
        );
      }
    } catch (err) {
      sonnerToast.error(
        typeof err === "string" ? err : "Failed to update store status"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search stores, owners, emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        {loading ? (
          <div className="text-center py-8">Loading stores...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update Status</TableHead>
                <TableHead>Registered On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStores.map((store) => {
                const upperStatus = store.status?.toUpperCase();
                return (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.brand}</TableCell>
                    <TableCell>{store.storeAdmin?.fullName || "-"}</TableCell>
                    <TableCell>{store.contact?.phone || "-"}</TableCell>
                    <TableCell>{store.contact?.email || "-"}</TableCell>
                    <TableCell>
                      <StoreStatusBadge status={store.status} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={upperStatus}
                        onValueChange={(val) =>
                          handleStatusChange(store.id, val)
                        }
                        disabled={updatingId === store.id}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="BLOCKED">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingId === store.id && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Updating...
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(store.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onViewDetails?.(store)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {upperStatus === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={() =>
                                onBlockStore
                                  ? onBlockStore(store.id)
                                  : handleStatusChange(store.id, "BLOCKED")
                              }
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Block Store
                            </DropdownMenuItem>
                          )}
                          {upperStatus === "BLOCKED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                onActivateStore
                                  ? onActivateStore(store.id)
                                  : handleStatusChange(store.id, "ACTIVE")
                              }
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activate Store
                            </DropdownMenuItem>
                          )}
                          {upperStatus === "PENDING" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  onActivateStore
                                    ? onActivateStore(store.id)
                                    : handleStatusChange(store.id, "ACTIVE")
                                }
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve Store
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  onBlockStore
                                    ? onBlockStore(store.id)
                                    : handleStatusChange(store.id, "BLOCKED")
                                }
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Reject Store
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {filteredStores.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-muted-foreground">
          No stores found matching your criteria.
        </div>
      )}
    </div>
  );
}
