import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { branchAdminRole } from "../../../utils/userRole";
import { useToast } from "@/components/ui/use-toast";
import { toast as sonnerToast } from "sonner";
import EmployeeStats from "./EmployeeStats";
import EmployeeTable from "./EmployeeTable";
import {
  AddEmployeeDialog,
  EditEmployeeDialog,
  ResetPasswordDialog,
  PerformanceDialog,
} from "./EmployeeDialogs";
import { useDispatch, useSelector } from "react-redux";
import {
  createBranchEmployee,
  findBranchEmployees,
  updateEmployee,
} from "../../../Redux Toolkit/features/employee/employeeThunks";
import { getOrdersByBranch } from "../../../Redux Toolkit/features/order/orderThunks";

const getStatusColor = (status) => {
  if (status === "Active") return "text-green-500";
  if (status === "Inactive") return "text-red-500";
  return "text-muted-foreground";
};

const BranchEmployees = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] =
    useState(false);
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

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
      emp.role === "ROLE_STORE_ADMIN" ||
      emp.role === "ROLE_STORE_MANAGER" ||
      emp.role === "ROLE_ADMIN";
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

  const handleAddEmployee = async (newEmployeeData) => {
    const targetBranchId = branch?.id || userProfile?.branchId;
    if (targetBranchId) {
      const data = {
        employee: {
          ...newEmployeeData,
          username: newEmployeeData.email.split("@")[0],
        },
        branchId: targetBranchId,
        token: localStorage.getItem("jwt"),
      };
      try {
        await dispatch(createBranchEmployee(data)).unwrap();
        setIsAddDialogOpen(false);
        sonnerToast.success(
          `${newEmployeeData.fullName} has been added to the branch.`,
        );
        toast({
          title: "Employee Created",
          description: `${newEmployeeData.fullName} has been added to the branch.`,
        });
      } catch (err) {
        const msg =
          typeof err === "string" ? err : "Failed to create branch employee";
        sonnerToast.error(msg);
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      }
    }
  };

  const handleEditEmployee = async (updatedEmployeeData) => {
    if (selectedEmployee?.id && localStorage.getItem("jwt")) {
      const data = {
        employeeId: selectedEmployee.id,
        employeeDetails: updatedEmployeeData,
        token: localStorage.getItem("jwt"),
      };
      try {
        await dispatch(updateEmployee(data)).unwrap();
        setIsEditDialogOpen(false);
        sonnerToast.success(
          `${updatedEmployeeData.fullName}'s details were saved.`,
        );
        toast({
          title: "Employee Updated",
          description: `${updatedEmployeeData.fullName}'s details were saved.`,
        });
      } catch (err) {
        const msg =
          typeof err === "string" ? err : "Failed to update branch employee";
        sonnerToast.error(msg);
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (branch?.id) {
      dispatch(findBranchEmployees({ branchId: branch.id }));
      dispatch(getOrdersByBranch({ branchId: branch.id }));
    }
  }, [dispatch, branch?.id]);

  const handleToggleAccess = async (employee) => {
    const nextAccess = !(employee.loginAccess !== false);
    if (!nextAccess && isSelfOrManager(employee)) {
      const warningMsg =
        "You cannot disable login access for your own account or a Branch Manager. Only a Store Admin can manage Branch Manager access.";
      sonnerToast.error(warningMsg);
      toast({
        title: "Action Not Allowed",
        description: warningMsg,
        variant: "destructive",
      });
      return;
    }

    if (employee?.id && localStorage.getItem("jwt")) {
      try {
        await dispatch(
          updateEmployee({
            employeeId: employee.id,
            employeeDetails: {
              ...employee,
              loginAccess: nextAccess,
            },
            token: localStorage.getItem("jwt"),
          }),
        ).unwrap();
        sonnerToast.success(
          `${employee.fullName}'s login access is now ${
            nextAccess ? "enabled" : "disabled"
          }.`,
        );
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
        sonnerToast.error(msg);
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
    const tempPassword = `Pos@${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      await dispatch(
        updateEmployee({
          employeeId: selectedEmployee.id,
          employeeDetails: {
            ...selectedEmployee,
            password: tempPassword,
          },
          token: localStorage.getItem("jwt"),
        }),
      ).unwrap();
      sonnerToast.success("Temporary password generated.");
      toast({
        title: "Temporary Password Generated",
        description: `Password for ${
          selectedEmployee.fullName || selectedEmployee.email
        } has been reset to: ${tempPassword}`,
      });
      setIsResetPasswordDialogOpen(false);
    } catch (err) {
      const msg =
        typeof err === "string" ? err : "Failed to reset employee password";
      sonnerToast.error(msg);
      toast({
        title: "Password Reset Failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (employee) => {
    setSelectedEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const openResetPasswordDialog = (employee) => {
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
        <h1 className="text-3xl font-bold tracking-tight">
          Employee Management
        </h1>
        <AddEmployeeDialog
          isAddDialogOpen={isAddDialogOpen}
          setIsAddDialogOpen={setIsAddDialogOpen}
          handleAddEmployee={handleAddEmployee}
          roles={branchAdminRole}
        />
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
        getStatusColor={getStatusColor}
        handleToggleAccess={handleToggleAccess}
        openEditDialog={openEditDialog}
        openResetPasswordDialog={openResetPasswordDialog}
        openPerformanceDialog={openPerformanceDialog}
      />

      <EditEmployeeDialog
        isEditDialogOpen={isEditDialogOpen}
        setIsEditDialogOpen={setIsEditDialogOpen}
        selectedEmployee={selectedEmployee}
        handleEditEmployee={handleEditEmployee}
        roles={branchAdminRole}
      />

      <ResetPasswordDialog
        isResetPasswordDialogOpen={isResetPasswordDialogOpen}
        setIsResetPasswordDialogOpen={setIsResetPasswordDialogOpen}
        selectedEmployee={selectedEmployee}
        handleResetPassword={handleResetPassword}
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
