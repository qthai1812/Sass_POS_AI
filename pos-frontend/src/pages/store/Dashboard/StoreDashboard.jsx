// File: src/pages/store/Dashboard/StoreDashboard.jsx
import { Outlet } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import {
  getStoreByAdmin,
  getStoreByEmployee,
} from "../../../Redux Toolkit/features/store/storeThunks";
import StoreSidebar from "./StoreSidebar";
import StoreTopbar from "./StoreTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function StoreDashboard({ children }) {
  const dispatch = useDispatch();
  const { store } = useSelector((state) => state.store);
  const { userProfile } = useSelector((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("jwt") && userProfile?.id && !store?.id) {
      if (userProfile?.role === "ROLE_STORE_MANAGER") {
        dispatch(getStoreByEmployee());
      } else {
        dispatch(getStoreByAdmin(localStorage.getItem("jwt")));
      }
    }
  }, [dispatch, store?.id, userProfile?.id, userProfile?.role]);

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
