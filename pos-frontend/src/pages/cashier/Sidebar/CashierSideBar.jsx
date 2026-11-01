import { Link, useNavigate, useLocation } from "react-router";
import { useSelector, useDispatch } from "react-redux";
import { useEffect } from "react";
import { getBranchById } from "../../../Redux Toolkit/features/branch/branchThunks";
import { endShift } from "../../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import { Button } from "../../../components/ui/button";
import { LogOutIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { logout } from "../../../Redux Toolkit/features/user/userThunks";
import { ThemeToggle } from "../../../components/theme-toggle";
import BranchInfo from "./BranchInfo";

const CashierSideBar = ({
  navItems,
  handleLogout: onShiftSummaryRedirect,
  onClose,
}) => {
  const dispatch = useDispatch();
  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);
  const { currentShift } = useSelector((state) => state.shiftReport);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (userProfile?.branchId) {
      dispatch(
        getBranchById({
          id: userProfile.branchId,
          jwt: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [dispatch, userProfile?.branchId]);

  const onLogoutClick = async () => {
    if (onClose) onClose();
    if (
      currentShift &&
      location.pathname !== "/cashier/shift-summary" &&
      onShiftSummaryRedirect
    ) {
      onShiftSummaryRedirect();
      return;
    }

    if (currentShift) {
      try {
        await dispatch(endShift()).unwrap();
      } catch {
        // Proceed with logout even if shift end fails
      }
    }
    await dispatch(logout());
    navigate("/auth/login");
  };

  return (
    <div className="w-64 border-r border-border bg-sidebar p-4 flex flex-col h-full relative">
      <div className="flex items-center justify-center p-2 mb-6">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          POS System
        </h1>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center justify-between p-3 rounded-md hover:bg-sidebar-accent transition-colors ${
              location.pathname === item.path
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            }`}
            onClick={() => {
              if (onClose) onClose();
            }}
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span>{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      {branch && <BranchInfo />}
      <Separator className="my-4" />

      <div className="space-y-2">
        <div className="flex items-center justify-center mb-2">
          <ThemeToggle />
        </div>

        <Button
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={onLogoutClick}
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          {currentShift ? "End Shift & Logout" : "Logout"}
        </Button>
      </div>
    </div>
  );
};

export default CashierSideBar;
