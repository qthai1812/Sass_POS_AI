// File: src/pages/store/Dashboard/StoreTopbar.jsx
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Bell,
  Search,
  AlertTriangle,
  Store,
  Menu,
  ArrowRightLeft,
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
import UserProfileMenu from "@/components/account/UserProfileMenu";
import api from "@/utils/api";
import { getStoreAlerts } from "@/Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";

export default function StoreTopbar({ onOpenMobileMenu }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { store } = useSelector((state) => state.store);
  const { userProfile } = useSelector((state) => state.user);
  const { storeAlerts } = useSelector((state) => state.storeAnalytics);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingTransferCount, setPendingTransferCount] = useState(0);
  const fetchedAlertsForUserRef = useRef(null);

  useEffect(() => {
    if (!store?.id) return;
    let mounted = true;
    api
      .get(`/api/branch-transfer-requests/store/${store.id}`)
      .then((res) => {
        if (mounted && Array.isArray(res.data)) {
          setPendingTransferCount(
            res.data.filter((r) => r.status === "PENDING").length,
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [store?.id]);

  useEffect(() => {
    if (
      userProfile?.id &&
      storeAlerts === null &&
      fetchedAlertsForUserRef.current !== userProfile.id
    ) {
      fetchedAlertsForUserRef.current = userProfile.id;
      dispatch(getStoreAlerts(userProfile.id));
    }
  }, [dispatch, userProfile?.id, storeAlerts]);

  const lowStockCount = storeAlerts?.lowStockAlerts?.length || 0;
  const inactiveCashiersCount = storeAlerts?.inactiveCashiers?.length || 0;
  const noSaleTodayCount = storeAlerts?.noSaleToday?.length || 0;
  const refundSpikeCount = storeAlerts?.refundSpike?.length || 0;
  const alertCount =
    lowStockCount + inactiveCashiersCount + noSaleTodayCount + refundSpikeCount;
  const totalBadgeCount = alertCount + pendingTransferCount;

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
              {totalBadgeCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {totalBadgeCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Store Alerts & Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pendingTransferCount > 0 && (
              <DropdownMenuItem
                onClick={() => navigate("/store/employees")}
                className="cursor-pointer"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4 text-amber-600" />
                <span>
                  {pendingTransferCount} đơn xin chuyển chi nhánh chờ duyệt
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => navigate("/store/alerts")}
              className="cursor-pointer"
            >
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              <span>
                {alertCount > 0
                  ? `${alertCount} store alerts (${lowStockCount} low stock, ${
                      inactiveCashiersCount + noSaleTodayCount + refundSpikeCount
                    } ops)`
                  : "No active store alerts"}
              </span>
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

        <UserProfileMenu />
      </div>
    </header>
  );
}
