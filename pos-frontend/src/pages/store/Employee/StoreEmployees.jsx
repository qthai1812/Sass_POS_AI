import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export default function StoreEmployees() {
  const dispatch = useDispatch();
  const { employees } = useSelector((state) => state.employee);
  const { store } = useSelector((state) => state.store);
  const { branches } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);

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
        employee.role === "ROLE_STORE_ADMIN" ||
        employee.role === "ROLE_ADMIN")
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
              ...employee,
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Employee Management
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" /> Add Employee
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
        onEdit={openEditDialog}
        onDelete={handleDeleteEmployee}
      />
    </div>
  );
}
