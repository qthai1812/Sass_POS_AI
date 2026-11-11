import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllSubscriptions,
  getExpiringSubscriptions,
  activateSubscription,
  cancelSubscription,
} from "@/Redux Toolkit/features/subscription/subscriptionThunks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function StoreSubscriptionsTable() {
  const dispatch = useDispatch();
  const { subscriptions = [], expiringSubscriptions = [], loading } =
    useSelector((state) => state.subscription);
  const [statusFilter, setStatusFilter] = useState("");
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);

  useEffect(() => {
    dispatch(getAllSubscriptions(statusFilter || undefined));
    dispatch(getExpiringSubscriptions(7));
  }, [dispatch, statusFilter]);

  const displayedList = showExpiringOnly ? expiringSubscriptions : subscriptions;

  const handleActivate = async (subId) => {
    try {
      await dispatch(activateSubscription(subId)).unwrap();
      toast({ title: "Đã kích hoạt", description: `Thuê bao #${subId} đã chuyển sang ACTIVE.` });
    } catch (err) {
      toast({ title: "Lỗi", description: String(err), variant: "destructive" });
    }
  };

  const handleCancel = async (subId) => {
    if (!window.confirm("Bạn có chắc muốn hủy thuê bao của cửa hàng này?")) return;
    try {
      await dispatch(cancelSubscription(subId)).unwrap();
      toast({ title: "Đã hủy", description: `Thuê bao #${subId} đã chuyển sang CANCELLED.` });
    } catch (err) {
      toast({ title: "Lỗi", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Danh sách Thuê bao Cửa hàng (Store Subscriptions)</h2>
          <p className="text-xs text-muted-foreground">
            Theo dõi các cửa hàng đã đăng ký gói, sắp hết hạn và kích hoạt/hủy gói thủ công
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showExpiringOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowExpiringOnly(!showExpiringOnly)}
          >
            <Clock className="w-4 h-4 mr-1 text-amber-500" />
            Sắp hết hạn 7 ngày ({expiringSubscriptions.length})
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => {
              setShowExpiringOnly(false);
              setStatusFilter(e.target.value);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIAL">TRIAL</option>
            <option value="PENDING">PENDING</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch(getAllSubscriptions(statusFilter || undefined))}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cửa hàng</TableHead>
              <TableHead>Gói cước</TableHead>
              <TableHead>Giá tiền</TableHead>
              <TableHead>Mã giao dịch</TableHead>
              <TableHead>Ngày hết hạn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  {loading ? "Đang tải..." : "Chưa có dữ liệu thuê bao."}
                </TableCell>
              </TableRow>
            ) : (
              displayedList.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>#{sub.id}</TableCell>
                  <TableCell className="font-medium">
                    {sub.storeName || `Store #${sub.storeId}`}
                  </TableCell>
                  <TableCell>{sub.planName}</TableCell>
                  <TableCell>
                    {Number(sub.amount || 0).toLocaleString("vi-VN")} ₫
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {sub.transactionId || "-"}
                  </TableCell>
                  <TableCell>
                    {sub.endDate
                      ? new Date(sub.endDate).toLocaleDateString("vi-VN")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sub.status === "ACTIVE"
                          ? "default"
                          : sub.status === "CANCELLED" || sub.status === "EXPIRED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {sub.status !== "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-600"
                        onClick={() => handleActivate(sub.id)}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Kích hoạt
                      </Button>
                    )}
                    {(sub.status === "ACTIVE" || sub.status === "TRIAL") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleCancel(sub.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Hủy gói
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
