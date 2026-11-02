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
import { Eye, MoreHorizontal, Ban, CheckCircle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import StoreStatusBadge from "./StoreStatusBadge";
import {
  getAllStores,
  moderateStore,
  deleteStore,
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

  const filteredStores = (stores || []).filter((store) => {
    const query = searchTerm.toLowerCase();
    return (
      (store.brand?.toLowerCase() || "").includes(query) ||
      (store.storeAdmin?.fullName?.toLowerCase() || "").includes(query) ||
      (store.contact?.email?.toLowerCase() || "").includes(query) ||
      (store.contact?.phone || "").includes(query)
    );
  });

  const handleStatusChange = async (storeId, newStatus) => {
    setUpdatingId(storeId);
    try {
      const updated = await dispatch(
        moderateStore({ storeId, action: newStatus })
      ).unwrap();
      const brandName = updated?.brand || "Store";
      sonnerToast.success(`Đã cập nhật trạng thái "${brandName}" sang ${newStatus}.`);
    } catch (err) {
      sonnerToast.error(
        typeof err === "string" ? err : "Failed to update store status"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // HÀM XÓA CỬA HÀNG VĨNH VIỄN
  const handleDeleteStore = async (store) => {
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa vĩnh viễn cửa hàng "${store.brand}" (#${store.id})?\nToàn bộ chi nhánh, sản phẩm và đơn hàng của cửa hàng này sẽ bị xóa!`
    );
    if (!confirmDelete) return;

    setUpdatingId(store.id);
    try {
      await dispatch(deleteStore(store.id)).unwrap();
      sonnerToast.success(`Đã xóa cửa hàng "${store.brand}" thành công.`);
    } catch (err) {
      sonnerToast.error(
        typeof err === "string" ? err : "Không thể xóa cửa hàng"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
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
                          {upperStatus !== "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={() =>
                                onActivateStore
                                  ? onActivateStore(store.id)
                                  : handleStatusChange(store.id, "ACTIVE")
                              }
                            >
                              <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                              Activate Store
                            </DropdownMenuItem>
                          )}
                          {upperStatus !== "BLOCKED" && (
                            <DropdownMenuItem
                              onClick={() =>
                                onBlockStore
                                  ? onBlockStore(store.id)
                                  : handleStatusChange(store.id, "BLOCKED")
                              }
                            >
                              <Ban className="mr-2 h-4 w-4 text-amber-600" />
                              Block Store
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteStore(store)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Store
                          </DropdownMenuItem>
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
    </div>
  );
}
