import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router";
import {
  UserCircle,
  User,
  Store,
  Settings,
  LogOut,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/Redux Toolkit/features/user/userThunks";
import { endShift } from "@/Redux Toolkit/features/shiftReport/shiftReportThunks";
import MyInformationDialog from "./MyInformationDialog";

const ROLE_ACCOUNT_HEADER = {
  ROLE_STORE_OWNER: "Store Account",
  ROLE_BRANCH_MANAGER: "Branch Account",
  ROLE_CASHIER: "Cashier Account",
  ROLE_SUPER_ADMIN: "Super Admin Account",
};

const ROLE_DEFAULT_NAME = {
  ROLE_STORE_OWNER: "Store Admin",
  ROLE_BRANCH_MANAGER: "Branch Manager",
  ROLE_CASHIER: "Cashier",
  ROLE_SUPER_ADMIN: "Super Admin",
};

export default function UserProfileMenu() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);
  const { currentShift } = useSelector((state) => state.shiftReport || {});

  const [myInfoOpen, setMyInfoOpen] = useState(false);
  const [myInfoTab, setMyInfoTab] = useState("profile");

  const role = userProfile?.role || "ROLE_STORE_OWNER";
  const isBranchEmployee =
    role === "ROLE_CASHIER" || role === "ROLE_BRANCH_MANAGER";

  const displayName =
    userProfile?.fullName ||
    store?.brand ||
    ROLE_DEFAULT_NAME[role] ||
    "Account";
  const displayEmail = userProfile?.email || "";

  const handleOpenMyInfo = (tab = "profile") => {
    setMyInfoTab(tab);
    setMyInfoOpen(true);
  };

  const handleLogout = async () => {
    if (role === "ROLE_CASHIER" && currentShift) {
      if (location.pathname !== "/cashier/shift-summary") {
        navigate("/cashier/shift-summary");
        return;
      }
      try {
        await dispatch(endShift()).unwrap();
      } catch {
        // Proceed with logout even if ending shift fails
      }
    }
    await dispatch(logout());
    navigate("/auth/login");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 rounded-full sm:rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/60 focus:outline-none"
          >
            <span className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
              <UserCircle className="w-6 h-6" />
            </span>
            <div className="hidden sm:block text-left max-w-[175px]">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {displayEmail}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            {ROLE_ACCOUNT_HEADER[role] || "My Account"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleOpenMyInfo("profile");
            }}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4 text-emerald-600" />
            <span>My Information</span>
          </DropdownMenuItem>

          {isBranchEmployee && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleOpenMyInfo("transfer");
              }}
              className="cursor-pointer"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4 text-amber-600" />
              <span>Branch Transfer Request</span>
            </DropdownMenuItem>
          )}

          {role === "ROLE_STORE_OWNER" && (
            <>
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
            </>
          )}

          {role === "ROLE_BRANCH_MANAGER" && (
            <DropdownMenuItem
              onClick={() => navigate("/branch/settings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Branch Settings</span>
            </DropdownMenuItem>
          )}

          {role === "ROLE_CASHIER" && (
            <DropdownMenuItem
              onClick={() => navigate("/cashier/shift-summary")}
              className="cursor-pointer"
            >
              <Clock className="mr-2 h-4 w-4" />
              <span>Shift Summary</span>
            </DropdownMenuItem>
          )}

          {role === "ROLE_SUPER_ADMIN" && (
            <DropdownMenuItem
              onClick={() => navigate("/super-admin/settings")}
              className="cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>System Settings</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>
              {role === "ROLE_CASHIER" && currentShift
                ? "End Shift & Logout"
                : "Logout"}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyInformationDialog
        open={myInfoOpen}
        onOpenChange={setMyInfoOpen}
        defaultTab={myInfoTab}
      />
    </>
  );
}
