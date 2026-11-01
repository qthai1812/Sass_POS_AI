import { Outlet } from "react-router";
import { useState } from "react";
import SuperAdminSidebar from "./components/SuperAdminSidebar";
import SuperAdminTopbar from "./components/SuperAdminTopbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function SuperAdminDashboard({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="hidden lg:flex shrink-0">
        <SuperAdminSidebar />
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <SuperAdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SuperAdminTopbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background/80 lg:rounded-tl-3xl shadow-xl lg:m-3 min-w-0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
