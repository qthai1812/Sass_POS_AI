import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Bell, Package, ShoppingBag, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserProfileMenu from "@/components/account/UserProfileMenu";
import { getTodayOverview } from "@/Redux Toolkit/features/branchAnalytics/branchAnalyticsThunks";

export default function BranchManagerTopbar({ onOpenMobileMenu }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { todayOverview } = useSelector((state) => state.branchAnalytics);
  const { inventories = [] } = useSelector((state) => state.inventory || {});
  const fetchedBranchIdRef = useRef(null);

  const branchId = branch?.id || userProfile?.branchId;

  useEffect(() => {
    if (
      branchId &&
      !todayOverview &&
      fetchedBranchIdRef.current !== branchId
    ) {
      fetchedBranchIdRef.current = branchId;
      dispatch(getTodayOverview(branchId));
    }
  }, [dispatch, branchId, todayOverview]);

  const lowStockCount =
    todayOverview?.lowStockItems !== undefined &&
    todayOverview?.lowStockItems !== null
      ? Number(todayOverview.lowStockItems)
      : Array.isArray(inventories)
        ? inventories.filter(
            (item) =>
              Number(item?.quantity ?? 0) <=
              Number(item?.minStockLevel ?? item?.minStock ?? 5),
          ).length
        : 0;

  return (
    <header className="bg-background border-b px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
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
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
            {branch ? branch.name : "Branch Dashboard"}
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block truncate">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {lowStockCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 text-xs">
                  {lowStockCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Branch Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/branch/inventory")}
              className="cursor-pointer"
            >
              <Package className="mr-2 h-4 w-4 text-amber-500" />
              <span>
                {lowStockCount > 0
                  ? `${lowStockCount} low stock inventory items`
                  : "Inventory levels healthy (0 low stock)"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate("/branch/orders")}
              className="cursor-pointer"
            >
              <ShoppingBag className="mr-2 h-4 w-4 text-emerald-500" />
              <span>View today&apos;s branch orders</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <UserProfileMenu />
      </div>
    </header>
  );
}
