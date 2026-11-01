import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import AuthRoutes from "./routes/AuthRoutes";
import StoreRoutes from "./routes/StoreRoutes";
import BranchManagerRoutes from "./routes/BranchManagerRoutes";
import { getUserProfile } from "./Redux Toolkit/features/user/userThunks";
import { clearUserState } from "./Redux Toolkit/features/user/userSlice";
import Landing from "./pages/common/Landing/Landing";
import CashierRoutes from "./routes/CashierRoutes";
import Onboarding from "./pages/onboarding/Onboarding";
import {
  getStoreByAdmin,
  getStoreByEmployee,
  getStoreById,
} from "./Redux Toolkit/features/store/storeThunks";
import { clearStoreState } from "./Redux Toolkit/features/store/storeSlice";
import SuperAdminRoutes from "./routes/SuperAdminRoutes";
import PageNotFound from "./pages/common/PageNotFound";
import { Ban, Clock, RefreshCw, LogOut } from "lucide-react";

const App = () => {
  const dispatch = useDispatch();
  const { userProfile, loading: userLoading } = useSelector(
    (state) => state.user,
  );
  const { store, loading: storeLoading } = useSelector((state) => state.store);
  const [storeChecked, setStoreChecked] = useState(false);

  useEffect(() => {
    localStorage.removeItem("pos_employee_access_overrides");
    const jwt = localStorage.getItem("jwt");
    if (jwt) {
      dispatch(getUserProfile(jwt));
    }
  }, [dispatch]);

  const userId = userProfile?.id;
  const userRole = userProfile?.role;
  const userStoreId = userProfile?.storeId;

  const fetchUserStore = useCallback(async () => {
    if (!userId || !userRole) {
      setStoreChecked(false);
      return;
    }
    if (userRole === "ROLE_ADMIN") {
      setStoreChecked(true);
      return;
    }
    try {
      if (userRole === "ROLE_STORE_ADMIN") {
        await dispatch(getStoreByAdmin()).unwrap();
      } else {
        try {
          await dispatch(getStoreByEmployee()).unwrap();
        } catch {
          if (userStoreId) {
            await dispatch(getStoreById(userStoreId)).unwrap();
          }
        }
      }
    } catch {
      // Handled by store state
    } finally {
      setStoreChecked(true);
    }
  }, [dispatch, userId, userRole, userStoreId]);

  useEffect(() => {
    fetchUserStore();
  }, [fetchUserStore]);

  const handleBackToLogin = () => {
    localStorage.removeItem("jwt");
    localStorage.removeItem("token");
    dispatch(clearUserState());
    dispatch(clearStoreState());
    window.location.href = "/auth/login";
  };

  if (userLoading && !userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (userProfile && userProfile.role) {
    if (userProfile.role === "ROLE_ADMIN") {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/super-admin" replace />} />
          <Route path="/super-admin/*" element={<SuperAdminRoutes />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      );
    }

    // All store and branch roles must wait until their store status is verified
    if (!storeChecked || (storeLoading && !store?.id)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          Loading store...
        </div>
      );
    }

    const effectiveStoreStatus = (
      store?.status ||
      userProfile?.storeStatus ||
      ""
    ).toUpperCase();
    const storeDisplayName =
      store?.brand || userProfile?.storeName || "Your Store";

    // Synchronized BLOCKED guard for Store Admin, Store Manager, Branch Manager, and Cashier
    if (effectiveStoreStatus === "BLOCKED") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-8 bg-card border border-destructive/30 rounded-xl shadow-lg text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <Ban className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Store Account Blocked
            </h2>
            <p className="text-sm font-medium text-red-600">
              {storeDisplayName} ({userProfile.fullName} — {userProfile.role})
            </p>
            <p className="text-muted-foreground text-sm">
              This store has been blocked by the Super Admin. All store
              administration, branch management, and POS sales terminals under
              this store are currently suspended.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={fetchUserStore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-md hover:bg-muted transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status Again
              </button>
              <button
                onClick={handleBackToLogin}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Synchronized PENDING guard for Store Admin, Store Manager, Branch Manager, and Cashier
    if (effectiveStoreStatus === "PENDING") {
      const isStoreAdmin = userProfile.role === "ROLE_STORE_ADMIN";
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-8 bg-card border border-amber-500/30 rounded-xl shadow-lg text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Store Pending Approval
            </h2>
            <p className="text-sm font-medium text-amber-700">
              {storeDisplayName} ({userProfile.fullName} — {userProfile.role})
            </p>
            <p className="text-muted-foreground text-sm">
              {isStoreAdmin
                ? "Your store is currently under review by our Super Admins. All store management, branch dashboards, and POS terminals will be unlocked once approved."
                : "The store this branch belongs to is currently awaiting Super Admin approval. Branch management and POS sales are temporarily unavailable until the store is approved."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={fetchUserStore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-md hover:bg-muted transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status Again
              </button>
              <button
                onClick={handleBackToLogin}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Orphaned / unassigned employee guard (e.g., when store or branch was deleted)
    const isBranchStaffRole =
      userProfile.role === "ROLE_BRANCH_CASHIER" ||
      userProfile.role === "ROLE_BRANCH_MANAGER";
    const isOrphanedEmployee =
      (userProfile.role === "ROLE_STORE_MANAGER" && (!store || !store.id)) ||
      (isBranchStaffRole && (!userProfile.branchId || !store || !store.id));

    if (isOrphanedEmployee) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md w-full p-8 bg-card border border-destructive/30 rounded-xl shadow-lg text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <Ban className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Account Not Assigned
            </h2>
            <p className="text-sm font-medium text-red-600">
              {userProfile.fullName} ({userProfile.role})
            </p>
            <p className="text-muted-foreground text-sm">
              Your employee account is not currently assigned to an active store
              or branch. Please contact your Store Administrator to restore
              assignment.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={fetchUserStore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-md hover:bg-muted transition-colors text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status Again
              </button>
              <button
                onClick={handleBackToLogin}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (userProfile.role === "ROLE_BRANCH_CASHIER") {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/cashier" replace />} />
          <Route path="/cashier/*" element={<CashierRoutes />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      );
    }

    if (
      userProfile.role === "ROLE_STORE_ADMIN" ||
      userProfile.role === "ROLE_STORE_MANAGER"
    ) {
      if (userProfile.role === "ROLE_STORE_ADMIN" && (!store || !store.id)) {
        return (
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/auth/onboarding" replace />}
            />
            <Route path="/auth/onboarding" element={<Onboarding />} />
            <Route
              path="*"
              element={<Navigate to="/auth/onboarding" replace />}
            />
          </Routes>
        );
      }

      return (
        <Routes>
          <Route path="/" element={<Navigate to="/store" replace />} />
          <Route path="/store/*" element={<StoreRoutes />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      );
    }

    if (userProfile.role === "ROLE_BRANCH_MANAGER") {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/branch" replace />} />
          <Route path="/branch/*" element={<BranchManagerRoutes />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      );
    }

    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/*" element={<AuthRoutes />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

export default App;
