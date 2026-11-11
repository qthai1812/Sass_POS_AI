// File: src/pages/store/Dashboard/StoreDashboard.jsx
import { Outlet } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import {
  getStoreByAdmin,
  updateStore,
} from "../../../Redux Toolkit/features/store/storeThunks";
import StoreSidebar from "./StoreSidebar";
import StoreTopbar from "./StoreTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function StoreDashboard({ children }) {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { store } = useSelector((state) => state.store);
  const { userProfile } = useSelector((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [resubmitBrand, setResubmitBrand] = useState("");
  const [resubmitDesc, setResubmitDesc] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("jwt") && userProfile?.id && !store?.id) {
      dispatch(getStoreByAdmin(localStorage.getItem("jwt")));
    }
  }, [dispatch, store?.id, userProfile?.id]);

  useEffect(() => {
    if (store) {
      setResubmitBrand(store.brand || "");
      setResubmitDesc(store.description || "");
    }
  }, [store]);

  const handleResubmitStore = async (e) => {
    e.preventDefault();
    if (!store?.id) return;
    setResubmitting(true);
    try {
      await dispatch(
        updateStore({
          id: store.id,
          storeData: {
            brand: resubmitBrand.trim() || store.brand,
            description: resubmitDesc.trim(),
          },
        }),
      ).unwrap();
      toast({
        title: "Đã gửi lại hồ sơ cửa hàng",
        description:
          "Hồ sơ cửa hàng đã chuyển sang trạng thái chờ phê duyệt (PENDING).",
      });
    } catch (err) {
      toast({
        title: "Lỗi gửi lại hồ sơ",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setResubmitting(false);
    }
  };

  if (store?.status === "PENDING") {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md p-8 bg-card border rounded-xl shadow-lg text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Store Pending Approval
          </h2>
          <p className="text-muted-foreground mb-6">
            Your store is currently under review by our super admins. You will
            be able to access your dashboard once it is approved.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = "/auth/login";
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (store?.status === "REJECTED") {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-lg w-full p-8 bg-card border border-orange-300 rounded-xl shadow-lg space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-orange-600">
              Hồ sơ đăng ký cửa hàng bị từ chối (Rejected)
            </h2>
            <p className="text-sm text-muted-foreground">
              Cửa hàng <strong>{store?.brand}</strong> cần cập nhật lại thông tin theo yêu cầu của Quản trị viên hệ thống trước khi kích hoạt.
            </p>
            {store?.rejectionReason && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-800 dark:text-orange-200 text-left">
                <strong>Lý do từ chối:</strong> {store.rejectionReason}
              </div>
            )}
          </div>

          <form onSubmit={handleResubmitStore} className="space-y-3 text-left">
            <div>
              <label className="text-xs font-semibold block mb-1">
                Tên thương hiệu cửa hàng
              </label>
              <Input
                value={resubmitBrand}
                onChange={(e) => setResubmitBrand(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">
                Mô tả / Ghi chú bổ sung hồ sơ
              </label>
              <Textarea
                rows={3}
                value={resubmitDesc}
                onChange={(e) => setResubmitDesc(e.target.value)}
                placeholder="Cập nhật thông tin cửa hàng để gửi duyệt lại..."
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/auth/login";
                }}
              >
                Quay lại Đăng nhập
              </Button>
              <Button type="submit" disabled={resubmitting}>
                {resubmitting ? "Đang gửi..." : "Cập nhật & Gửi duyệt lại"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (store?.status === "BLOCKED") {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md p-8 bg-card border border-red-200 rounded-xl shadow-lg text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Cửa hàng đã bị Tạm khóa (Blocked)
          </h2>
          <p className="text-muted-foreground mb-6">
            Cửa hàng "{store?.brand}" hiện đang bị khóa bởi Quản trị viên hệ thống (Super Admin). Vui lòng liên hệ bộ phận hỗ trợ.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = "/auth/login";
            }}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Quay lại Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="hidden lg:flex shrink-0">
        <StoreSidebar />
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <StoreSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StoreTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background/80 lg:rounded-tl-3xl shadow-xl lg:m-3 min-w-0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
