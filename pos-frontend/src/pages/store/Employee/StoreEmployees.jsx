import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmployeeForm, EmployeeTable } from ".";
import { useDispatch, useSelector } from "react-redux";
import {
  createStoreEmployee,
  findStoreEmployees,
  updateEmployee,
  deleteEmployee,
} from "@/Redux Toolkit/features/employee/employeeThunks";
import { getAllBranchesByStore } from "@/Redux Toolkit/features/branch/branchThunks";
import { storeAdminRole } from "../../../utils/userRole";
import { toast } from "sonner";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import api from "@/utils/api";

export default function StoreEmployees() {
  const dispatch = useDispatch();
  const { employees } = useSelector((state) => state.employee);
  const { store } = useSelector((state) => state.store);
  const { branches } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { entitlements, refresh: refreshEntitlements } = usePlanEntitlements();

  const isUserLimitReached =
    entitlements?.maxUsers != null &&
    entitlements?.usedUsers >= entitlements?.maxUsers;

  useEffect(() => {
    localStorage.removeItem("pos_employee_access_overrides");
    localStorage.removeItem("pos_disabled_employees_v2");
  }, []);

  useEffect(() => {
    if (store?.id) {
      dispatch(
        findStoreEmployees({
          storeId: store?.id,
          token: localStorage.getItem("jwt"),
        }),
      );
      dispatch(
        getAllBranchesByStore({
          storeId: store?.id,
          jwt: localStorage.getItem("jwt"),
        }),
      );
    }
  }, [dispatch, store?.id]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetTargetEmployee, setResetTargetEmployee] = useState(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [transferRequests, setTransferRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  const fetchTransferRequests = useCallback(async () => {
    if (!store?.id) return;
    setLoadingRequests(true);
    try {
      const res = await api.get(`/api/branch-transfer-requests/store/${store.id}`);
      setTransferRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch branch transfer requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  }, [store?.id]);

  useEffect(() => {
    if (store?.id) {
      fetchTransferRequests();
    }
  }, [store?.id, fetchTransferRequests]);

  const handleReviewTransfer = async (reqId, action) => {
    setReviewingId(reqId);
    try {
      await api.put(`/api/branch-transfer-requests/${reqId}/review`, {
        action,
        reviewNote: reviewNotes[reqId] || "",
      });
      toast.success(
        action === "APPROVED"
          ? "Đã phê duyệt chuyển chi nhánh! Nhân viên đã được chuyển sang chi nhánh mới."
          : "Đã từ chối đơn yêu cầu chuyển chi nhánh.",
      );
      await fetchTransferRequests();
      if (store?.id) {
        dispatch(
          findStoreEmployees({
            storeId: store.id,
            token: localStorage.getItem("jwt"),
          }),
        );
        dispatch(
          getAllBranchesByStore({
            storeId: store.id,
            jwt: localStorage.getItem("jwt"),
          }),
        );
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể xử lý đơn chuyển chi nhánh",
      );
    } finally {
      setReviewingId(null);
    }
  };

  const pendingTransferRequests = transferRequests.filter(
    (r) => r.status === "PENDING",
  );
  const displayedTransferRequests = showAllRequests
    ? transferRequests
    : pendingTransferRequests;

  const handleAddEmployee = async (newEmployeeData) => {
    if (store?.id && localStorage.getItem("jwt")) {
      try {
        await dispatch(
          createStoreEmployee({
            employee: {
              ...newEmployeeData,
              storeId: store?.id,
              username: newEmployeeData.email.split("@")[0],
            },
            storeId: store?.id,
            token: localStorage.getItem("jwt"),
          }),
        ).unwrap();
        toast.success("Employee added successfully!");
        setIsAddDialogOpen(false);
        refreshEntitlements();
      } catch (err) {
        toast.error(
          typeof err === "string" ? err : "Failed to create employee",
        );
      }
    }
  };

  const handleEditEmployee = async (updatedEmployeeData) => {
    if (currentEmployee?.id && localStorage.getItem("jwt")) {
      try {
        await dispatch(
          updateEmployee({
            employeeId: currentEmployee.id,
            employeeDetails: updatedEmployeeData,
            token: localStorage.getItem("jwt"),
          }),
        ).unwrap();
        toast.success("Employee updated successfully!");
        setIsEditDialogOpen(false);
      } catch (err) {
        toast.error(
          typeof err === "string" ? err : "Failed to update employee",
        );
      }
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (localStorage.getItem("jwt")) {
      try {
        await dispatch(
          deleteEmployee({
            employeeId: id,
            token: localStorage.getItem("jwt"),
          }),
        ).unwrap();
        toast.success("Employee deleted successfully!");
        refreshEntitlements();
      } catch (err) {
        toast.error(
          typeof err === "string" ? err : "Failed to delete employee",
        );
      }
    }
  };

  const openEditDialog = (employee) => {
    setCurrentEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const openResetPasswordDialog = (employee) => {
    const isSelf =
      userProfile &&
      (employee.id === userProfile.id ||
        (employee.email &&
          userProfile.email &&
          employee.email.toLowerCase() === userProfile.email.toLowerCase()));
    const isStoreAdmin =
      employee.role === "ROLE_STORE_OWNER" ||
      employee.role === "ROLE_SUPER_ADMIN";
    if (isSelf || isStoreAdmin) {
      toast.error("Please use Account Settings to update your own password.");
      return;
    }
    setGeneratedTempPassword("");
    setCopiedPassword(false);
    setResetTargetEmployee(employee);
    setIsResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTargetEmployee?.id || !localStorage.getItem("jwt")) return;
    const tempPassword = `Pos@${Math.floor(100000 + Math.random() * 900000)}`;
    setResettingPassword(true);
    try {
      await dispatch(
        updateEmployee({
          employeeId: resetTargetEmployee.id,
          employeeDetails: {
            password: tempPassword,
          },
          token: localStorage.getItem("jwt"),
        }),
      ).unwrap();
      setGeneratedTempPassword(tempPassword);
      toast.success(
        `Đã đặt lại mật khẩu tạm thời cho ${resetTargetEmployee.fullName}.`,
      );
    } catch (err) {
      toast.error(
        typeof err === "string" ? err : "Failed to reset employee password",
      );
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyTempPassword = async () => {
    if (!generatedTempPassword) return;
    try {
      await navigator.clipboard.writeText(generatedTempPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 1800);
    } catch {
      // Clipboard API may be unavailable on non-HTTPS origins
    }
  };

  const employeesWithAccess = (employees || []).map((emp) => ({
    ...emp,
    loginAccess: emp.loginAccess !== false,
  }));

  const handleToggleAccess = async (employee) => {
    const isSelf =
      userProfile &&
      (employee.id === userProfile.id ||
        (employee.email &&
          userProfile.email &&
          employee.email.toLowerCase() === userProfile.email.toLowerCase()));
    const nextAccess = !(employee.loginAccess !== false);
    if (
      !nextAccess &&
      (isSelf ||
        employee.role === "ROLE_STORE_OWNER" ||
        employee.role === "ROLE_SUPER_ADMIN")
    ) {
      toast.error(
        "You cannot disable login access for your own Store Admin account.",
      );
      return;
    }

    if (employee?.id && localStorage.getItem("jwt")) {
      try {
        await dispatch(
          updateEmployee({
            employeeId: employee.id,
            employeeDetails: {
              loginAccess: nextAccess,
            },
            token: localStorage.getItem("jwt"),
          }),
        ).unwrap();
        toast.success(
          `${employee.fullName}'s login access is now ${
            nextAccess ? "enabled" : "disabled"
          }.`,
        );
      } catch (err) {
        toast.error(
          typeof err === "string"
            ? err
            : "Failed to update employee login access",
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Employee Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý toàn bộ nhân sự chuỗi (Quản lý chi nhánh &amp; Thu ngân), cấp/đặt lại mật khẩu và phê duyệt chuyển chi nhánh.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isUserLimitReached}
              title={
                isUserLimitReached ? "Đã đạt giới hạn nhân sự của gói cước" : ""
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
              {entitlements?.maxUsers
                ? ` (${entitlements.usedUsers}/${entitlements.maxUsers})`
                : ""}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <EmployeeForm
              onSubmit={handleAddEmployee}
              initialData={{
                fullName: "",
                email: "",
                password: "",
                phone: "",
                role: "",
                branchId: "",
              }}
              roles={storeAdminRole}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>
            <EmployeeForm
              onSubmit={handleEditEmployee}
              roles={storeAdminRole}
              initialData={
                currentEmployee
                  ? {
                      ...currentEmployee,
                      fullName: currentEmployee.fullName || "",
                      email: currentEmployee.email || "",
                      password: "",
                      phone: currentEmployee.phone || "",
                      role: currentEmployee.role || "",
                      branchId: currentEmployee.branchId
                        ? String(currentEmployee.branchId)
                        : "",
                    }
                  : null
              }
            />
          </DialogContent>
        </Dialog>
      </div>

      <EmployeeTable
        employees={employeesWithAccess}
        currentUser={userProfile}
        branches={branches}
        onToggleAccess={handleToggleAccess}
        onResetPassword={openResetPasswordDialog}
        onEdit={openEditDialog}
        onDelete={handleDeleteEmployee}
      />

      {/* Reset Password Dialog */}
      {resetTargetEmployee && (
        <Dialog
          open={isResetDialogOpen}
          onOpenChange={(open) => {
            setIsResetDialogOpen(open);
            if (!open) setGeneratedTempPassword("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Employee Password</DialogTitle>
            </DialogHeader>
            {generatedTempPassword ? (
              <div className="py-4 space-y-3">
                <p className="text-sm">
                  Mật khẩu tạm thời cho{" "}
                  <strong>
                    {resetTargetEmployee.fullName || resetTargetEmployee.email}
                  </strong>{" "}
                  đã được tạo:
                </p>
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
                  <code className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300 select-all">
                    {generatedTempPassword}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyTempPassword}
                    className="gap-1.5"
                  >
                    {copiedPassword ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Phiên đăng nhập cũ của nhân viên đã bị thu hồi. Hãy gửi mật khẩu tạm thời này để nhân viên đăng nhập và đổi mật khẩu mới.
                </p>
              </div>
            ) : (
              <div className="py-4">
                <p>
                  Bạn có chắc chắn muốn đặt lại mật khẩu cho{" "}
                  <strong>{resetTargetEmployee.fullName}</strong> (
                  {resetTargetEmployee.role === "ROLE_BRANCH_MANAGER"
                    ? "Quản lý chi nhánh"
                    : "Thu ngân"}
                  )?
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Hệ thống sẽ sinh một mật khẩu tạm thời mới và thu hồi phiên đăng nhập hiện tại.
                </p>
              </div>
            )}
            <DialogFooter>
              {generatedTempPassword ? (
                <Button onClick={() => setIsResetDialogOpen(false)}>
                  Đóng
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsResetDialogOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? "Đang xử lý..." : "Reset Password"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Danh sách đơn xin chuyển chi nhánh của nhân viên */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                Đơn yêu cầu chuyển chi nhánh của nhân viên
                {pendingTransferRequests.length > 0 && (
                  <Badge className="bg-amber-500 text-white">
                    {pendingTransferRequests.length} chờ duyệt
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Phê duyệt để tự động chuyển nhân viên sang chi nhánh mới trong cùng chuỗi cửa hàng.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllRequests((v) => !v)}
              >
                {showAllRequests
                  ? `Chỉ xem đơn chờ duyệt (${pendingTransferRequests.length})`
                  : `Xem toàn bộ lịch sử (${transferRequests.length})`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang tải danh sách yêu cầu...
            </div>
          ) : displayedTransferRequests.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
              {showAllRequests
                ? "Chưa có đơn yêu cầu chuyển chi nhánh nào trong cửa hàng."
                : "Hiện không có đơn yêu cầu chuyển chi nhánh nào đang chờ duyệt."}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTransferRequests.map((req) => {
                const isPending = req.status === "PENDING";
                return (
                  <div
                    key={req.id}
                    className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {req.employeeName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({req.employeeEmail})
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {req.employeeRole === "ROLE_BRANCH_MANAGER"
                            ? "Quản lý chi nhánh"
                            : "Thu ngân"}
                        </Badge>
                        {req.status === "PENDING" && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-xs"
                          >
                            <Clock className="w-3 h-3 mr-1" /> Chờ duyệt
                          </Badge>
                        )}
                        {req.status === "APPROVED" && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Đã duyệt
                          </Badge>
                        )}
                        {req.status === "REJECTED" && (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-xs"
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Từ chối
                          </Badge>
                        )}
                        {req.status === "CANCELLED" && (
                          <Badge
                            variant="outline"
                            className="bg-slate-500/15 text-slate-700 border-slate-500/30 text-xs"
                          >
                            <Ban className="w-3 h-3 mr-1" /> Đã hủy
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm flex items-center gap-2 font-medium">
                        <span className="text-muted-foreground">Từ:</span>
                        <span>{req.fromBranchName}</span>
                        <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                        <span className="text-muted-foreground">Đến:</span>
                        <span className="text-emerald-600 font-semibold">
                          {req.toBranchName}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <strong>Lý do nhân viên:</strong> {req.reason}
                      </p>

                      {req.reviewNote && !isPending && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Ghi chú duyệt:</strong> {req.reviewNote}
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground">
                        Gửi lúc:{" "}
                        {req.createdAt
                          ? new Date(req.createdAt).toLocaleString("vi-VN")
                          : "—"}
                      </p>
                    </div>

                    {isPending && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <Input
                          placeholder="Ghi chú phản hồi (tùy chọn)..."
                          value={reviewNotes[req.id] || ""}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          className="h-9 text-xs w-full sm:w-52"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={reviewingId === req.id}
                            onClick={() =>
                              handleReviewTransfer(req.id, "APPROVED")
                            }
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={reviewingId === req.id}
                            onClick={() =>
                              handleReviewTransfer(req.id, "REJECTED")
                            }
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
