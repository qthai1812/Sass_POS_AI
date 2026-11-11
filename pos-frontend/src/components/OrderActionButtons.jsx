import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateOrderStatus } from "@/Redux Toolkit/features/order/orderThunks";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function OrderActionButtons({ order }) {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);

  const role = userProfile?.role;
  // Option 2A: Không cho xóa vĩnh viễn chứng từ đơn hàng; chỉ Quản lý chi nhánh duyệt/hủy đơn tại chi nhánh.
  const canManageStatus = role === "ROLE_BRANCH_MANAGER";

  const status = order?.status?.toUpperCase() || "COMPLETED";

  const handleChangeStatus = async (newStatus) => {
    const label =
      newStatus === "CANCELLED" ? "hủy đơn hàng" : "hoàn tất đơn hàng";
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

      {canManageStatus &&
        status !== "CANCELLED" &&
        status !== "REFUNDED" &&
        status !== "PARTIALLY_REFUNDED" && (
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
    </div>
  );
}
