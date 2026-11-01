import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import {
  Bell,
  User,
  Search,
  Store,
  Clock,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { logout } from "@/Redux Toolkit/features/user/userThunks";

export default function SuperAdminTopbar({ onOpenMobileMenu }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userProfile } = useSelector((state) => state.user);
  const { dashboardSummary } = useSelector((state) => state.adminDashboard);
  const [searchTerm, setSearchTerm] = useState("");

  const pendingCount = dashboardSummary?.pendingStores ?? 0;

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      if (q.includes("plan") || q.includes("sub"))
        navigate("/super-admin/subscriptions");
      else if (q.includes("req") || q.includes("pend"))
        navigate("/super-admin/requests");
      else if (q.includes("set")) navigate("/super-admin/settings");
      else if (q.includes("dash")) navigate("/super-admin/dashboard");
      else navigate("/super-admin/stores");
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/auth/login");
  };

  return (
    <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onOpenMobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onOpenMobileMenu}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            Super Admin Panel
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search stores, plans, requests (Enter)..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>System Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/super-admin/requests")}
                className="cursor-pointer"
              >
                <Clock className="mr-2 h-4 w-4 text-amber-500" />
                <span>Review pending requests ({pendingCount})</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/super-admin/stores")}
                className="cursor-pointer"
              >
                <Store className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Manage active & blocked stores</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">
                    {userProfile?.fullName || "Super Admin"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {userProfile?.email || "superadmin@pos.com"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="w-5 h-5" />
                </Button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Super Admin Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/super-admin/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>System Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
