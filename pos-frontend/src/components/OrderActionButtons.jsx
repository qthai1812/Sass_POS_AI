import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  updateOrderStatus,
  deleteOrder,
} from "@/Redux Toolkit/features/order/orderThunks";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function OrderActionButtons({ order }) {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);

  const role = userProfile?.role;
  // Khớp với AccessControlService.assertStoreLevelOrAdmin() ở Backend
  const canHardDelete =
    role === "ROLE_ADMIN" ||
    role === "ROLE_STORE_ADMIN" ||
    role === "ROLE_STORE_MANAGER";

  const canManageStatus =
    canHardDelete || role === "ROLE_BRANCH_MANAGER";

  const status = order?.status?.toUpperCase() || "COMPLETED";

  const handleChangeStatus = async (newStatus) => {
    const label = newStatus === "CANCELLED" ? "hủy đơn hàng" : "hoàn tất đơn hàng";
    if (
      newStatus === "CANCELLED" &&
      !window.confirm(
        `Bạn có chắc chắn muốn ${label} #${order.id}? Hệ thống sẽ tự động hoàn lại tồn kho và điểm tích lũy.`
      )
    ) {
      return;
    }
    try {
      await dispatch(
        updateOrderStatus({ id: order.id, status: newStatus })
      ).unwrap();
      toast({
        title: "Cập nhật thành công",
        description: `Đơn hàng #${order.id} đã chuyển sang ${newStatus}.`,
      });
    } catch (err) {
      toast({
        title: "Không thể cập nhật trạng thái",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (
      !window.confirm(
        `Xóa vĩnh viễn đơn hàng #${order.id}? Tồn kho và điểm tích lũy chưa hoàn sẽ được khôi phục tự động.`
      )
    ) {
      return;
    }
    try {
      await dispatch(deleteOrder(order.id)).unwrap();
      toast({
        title: "Đã xóa đơn hàng",
        description: `Đơn hàng #${order.id} đã được xóa khỏi hệ thống.`,
      });
    } catch (err) {
      toast({
        title: "Lỗi xóa đơn hàng",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canManageStatus && status === "PENDING" && (
        <Button
          size="sm"
          variant="outline"
          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          onClick={() => handleChangeStatus("COMPLETED")}
          title="Đánh dấu Hoàn tất"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Hoàn tất
        </Button>
      )}

      {canManageStatus && status !== "CANCELLED" && status !== "REFUNDED" && (
        <Button
          size="sm"
          variant="outline"
          className="text-amber-600 border-amber-200 hover:bg-amber-50"
          onClick={() => handleChangeStatus("CANCELLED")}
          title="Hủy đơn & Hoàn kho"
        >
          <XCircle className="w-4 h-4 mr-1" />
          Hủy đơn
        </Button>
      )}

      {canHardDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={handleDeleteOrder}
          title="Xóa vĩnh viễn (Chỉ Store Admin/Manager)"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
