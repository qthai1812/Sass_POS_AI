// File: src/pages/store/Dashboard/StoreTopbar.jsx
import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import {
  Bell,
  UserCircle,
  Search,
  Settings,
  LogOut,
  AlertTriangle,
  Store,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "../../../components/theme-toggle";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { logout } from "../../../Redux Toolkit/features/user/userThunks";

export default function StoreTopbar({ onOpenMobileMenu }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (q.includes("branch")) navigate("/store/branches");
      else if (q.includes("emp") || q.includes("staff"))
        navigate("/store/employees");
      else if (q.includes("cat")) navigate("/store/categories");
      else if (q.includes("coup")) navigate("/store/coupons");
      else if (q.includes("sale") || q.includes("rev"))
        navigate("/store/sales");
      else if (q.includes("rep")) navigate("/store/reports");
      else navigate("/store/products");
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/auth/login");
  };

  return (
    <header className="w-full h-16 bg-background border-b flex items-center px-4 sm:px-6 justify-between gap-3 shadow-xs shrink-0">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onOpenMobileMenu && (
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products, branches, reports..."
            className="w-full pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Notifications"
            >
              <Bell className="text-muted-foreground w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                3
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Store Alerts & Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/store/alerts")}
              className="cursor-pointer"
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              <span>View low stock & inactive cashier alerts</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/store/sales")}
              className="cursor-pointer"
            >
              <Store className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Check daily revenue breakdown</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-90">
              <span className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary shrink-0">
                <UserCircle className="w-6 h-6" />
              </span>
              <div className="hidden sm:block text-left max-w-[160px]">
                <p className="text-sm font-medium text-foreground leading-none truncate">
                  {userProfile?.fullName || store?.brand || "Store Admin"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {userProfile?.email || "Store Administrator"}
                </p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Store Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/store/stores")}
              className="cursor-pointer"
            >
              <Store className="mr-2 h-4 w-4" />
              <span>Store Information</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/store/settings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
