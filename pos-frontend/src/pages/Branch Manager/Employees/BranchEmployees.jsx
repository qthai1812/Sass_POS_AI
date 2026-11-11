import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import EmployeeStats from "./EmployeeStats";
import EmployeeTable from "./EmployeeTable";
import {
  ResetPasswordDialog,
  PerformanceDialog,
} from "./EmployeeDialogs";
import { useDispatch, useSelector } from "react-redux";
import {
  findBranchEmployees,
  updateEmployee,
} from "../../../Redux Toolkit/features/employee/employeeThunks";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";

const BranchEmployees = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] =
    useState(false);
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { employees } = useSelector((state) => state.employee);
  const { userProfile } = useSelector((state) => state.user);

  useEffect(() => {
    localStorage.removeItem("pos_employee_access_overrides");
    localStorage.removeItem("pos_disabled_employees_v2");
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const isSelfOrManager = (emp) => {
    if (!emp) return false;
    const isSelf =
      userProfile &&
      (emp.id === userProfile.id ||
        (emp.email &&
          userProfile.email &&
          emp.email.toLowerCase() === userProfile.email.toLowerCase()));
    const isManager =
      emp.role === "ROLE_BRANCH_MANAGER" ||
      emp.role === "ROLE_STORE_OWNER" ||
      emp.role === "ROLE_SUPER_ADMIN";
    return Boolean(isSelf || isManager);
  };

  const employeesWithAccess = (employees || []).map((emp) => ({
    ...emp,
    loginAccess: emp.loginAccess !== false,
  }));

  const filteredEmployees = employeesWithAccess.filter(
    (emp) =>
      emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone?.includes(searchTerm) ||
      emp.role?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    if (branch?.id) {
      dispatch(findBranchEmployees({ branchId: branch.id }));
      dispatch(getOrdersByBranch({ branchId: branch.id }));
    }
  }, [dispatch, branch?.id]);

  const handleToggleAccess = async (employee) => {
    if (isSelfOrManager(employee)) {
      const warningMsg =
        "Chỉ Store Owner mới có quyền khóa/mở quyền đăng nhập cho Quản lý chi nhánh hoặc tài khoản quản trị.";
      toast({
        title: "Action Not Allowed",
        description: warningMsg,
        variant: "destructive",
      });
      return;
    }

    const nextAccess = !(employee.loginAccess !== false);
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
        toast({
          title: nextAccess ? "Login Access Enabled" : "Login Access Disabled",
          description: `${employee.fullName}'s login access is now ${
            nextAccess ? "enabled" : "disabled"
          }.`,
        });
      } catch (err) {
        const msg =
          typeof err === "string"
            ? err
            : "Failed to update employee login access";
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      }
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee?.id || !localStorage.getItem("jwt")) return;
    if (isSelfOrManager(selectedEmployee)) {
      const warningMsg =
        "Chỉ Store Owner mới có quyền đặt lại mật khẩu cho Quản lý chi nhánh hoặc tài khoản quản trị.";
      toast({
        title: "Action Not Allowed",
        description: warningMsg,
        variant: "destructive",
      });
      return;
    }

    const tempPassword = `Pos@${Math.floor(100000 + Math.random() * 900000)}`;
    setIsResettingPassword(true);
    try {
      await dispatch(
        updateEmployee({
          employeeId: selectedEmployee.id,
          employeeDetails: {
            password: tempPassword,
          },
          token: localStorage.getItem("jwt"),
        }),
      ).unwrap();
      setGeneratedPassword(tempPassword);
      toast({
        title: "Temporary Password Generated",
        description: `Password for ${
          selectedEmployee.fullName || selectedEmployee.email
        } has been reset to: ${tempPassword}`,
      });
    } catch (err) {
      const msg =
        typeof err === "string" ? err : "Failed to reset employee password";
      toast({
        title: "Password Reset Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openResetPasswordDialog = (employee) => {
    if (isSelfOrManager(employee)) {
      const warningMsg =
        "Chỉ Store Owner mới có quyền đặt lại mật khẩu cho Quản lý chi nhánh hoặc tài khoản quản trị.";
      toast({
        title: "Action Not Allowed",
        description: warningMsg,
        variant: "destructive",
      });
      return;
    }
    setGeneratedPassword("");
    setSelectedEmployee(employee);
    setIsResetPasswordDialogOpen(true);
  };

  const openPerformanceDialog = (employee) => {
    setSelectedEmployee(employee);
    setIsPerformanceDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Branch Staff Supervision
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi hiệu suất nhân sự tại chi nhánh, khóa/mở quyền đăng nhập và đặt lại mật khẩu cho Thu ngân. Việc tuyển mới, chỉnh sửa hồ sơ hoặc luân chuyển nhân sự do Store Owner thực hiện.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Cashier Operations Only
        </Badge>
      </div>

      <EmployeeStats employees={employeesWithAccess} />

      <Card>
        <CardContent className="p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search employees by name, email, role..."
              className="pl-8"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </CardContent>
      </Card>

      <EmployeeTable
        employees={filteredEmployees}
        currentUser={userProfile}
        handleToggleAccess={handleToggleAccess}
        openResetPasswordDialog={openResetPasswordDialog}
        openPerformanceDialog={openPerformanceDialog}
      />

      <ResetPasswordDialog
        isResetPasswordDialogOpen={isResetPasswordDialogOpen}
        setIsResetPasswordDialogOpen={(open) => {
          setIsResetPasswordDialogOpen(open);
          if (!open) setGeneratedPassword("");
        }}
        selectedEmployee={selectedEmployee}
        handleResetPassword={handleResetPassword}
        generatedPassword={generatedPassword}
        isResetting={isResettingPassword}
      />

      <PerformanceDialog
        isPerformanceDialogOpen={isPerformanceDialogOpen}
        setIsPerformanceDialogOpen={setIsPerformanceDialogOpen}
        selectedEmployee={selectedEmployee}
      />
    </div>
  );
};

export default BranchEmployees;
