import React, { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { getBranchById } from "@/Redux Toolkit/features/branch/branchThunks";
import BranchManagerSidebar from "./BranchManagerSidebar";
import BranchManagerTopbar from "./BranchManagerTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function BranchManagerDashboard({ children }) {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("jwt") && userProfile?.branchId) {
      dispatch(
        getBranchById({
          id: userProfile.branchId,
          jwt: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [dispatch, userProfile]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <BranchManagerSidebar />
      </div>

      {/* Mobile & Tablet Drawer Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <BranchManagerSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <BranchManagerTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background/80 lg:rounded-tl-3xl shadow-xl lg:m-3 min-w-0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
