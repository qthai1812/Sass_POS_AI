import React from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  UserX,
  UserCheck,
  Key,
} from "lucide-react";

const ROLE_META = {
  ROLE_SUPER_ADMIN: {
    label: "Super Admin",
    className: "bg-purple-100 text-purple-800 border-purple-300",
  },
  ROLE_STORE_OWNER: {
    label: "Chủ chuỗi (Store Owner)",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  ROLE_BRANCH_MANAGER: {
    label: "Quản lý chi nhánh",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  ROLE_CASHIER: {
    label: "Thu ngân",
    className: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

const EmployeeTable = ({
  employees,
  currentUser,
  branches,
  onToggleAccess,
  onResetPassword,
  onEdit,
  onDelete,
}) => {
  if (!employees || employees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No employees found.</div>
    );
  }

  const getBranchName = (employee) => {
    if (employee.branchName) return employee.branchName;
    if (!employee.branchId || !branches) return "N/A";
    const branch = branches.find((b) => b.id === employee.branchId);
    return branch ? branch.name : "N/A";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Login Access</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const hasAccess = employee.loginAccess !== false;
            const isSelf =
              currentUser &&
              (employee.id === currentUser.id ||
                (employee.email &&
                  currentUser.email &&
                  employee.email.toLowerCase() ===
                    currentUser.email.toLowerCase()));
            const isStoreAdmin =
              employee.role === "ROLE_STORE_OWNER" ||
              employee.role === "ROLE_SUPER_ADMIN";
            const cannotDisable = hasAccess && Boolean(isSelf || isStoreAdmin);
            const cannotResetOrDelete = Boolean(isSelf || isStoreAdmin);
            const roleMeta = ROLE_META[employee.role] || {
              label: employee.role,
              className: "",
            };

            return (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">
                  {employee.fullName}
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (You)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{employee.phone}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleMeta.className}>
                    {roleMeta.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{getBranchName(employee)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      hasAccess
                        ? "bg-green-100 text-green-800 hover:bg-green-100/80"
                        : "bg-red-100 text-red-800 hover:bg-red-100/80"
                    }
                    variant="secondary"
                  >
                    {hasAccess ? "Enabled" : "Disabled"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {onToggleAccess && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cannotDisable}
                      className={
                        cannotDisable ? "opacity-30 cursor-not-allowed" : ""
                      }
                      onClick={() => onToggleAccess(employee)}
                      title={
                        isSelf
                          ? "You cannot disable your own login access"
                          : isStoreAdmin && hasAccess
                            ? "Protected Store Owner account"
                            : hasAccess
                              ? "Disable Access"
                              : "Enable Access"
                      }
                    >
                      {hasAccess ? (
                        <UserX className="h-4 w-4 text-red-500" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  )}
                  {onResetPassword && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cannotResetOrDelete}
                      className={
                        cannotResetOrDelete
                          ? "opacity-30 cursor-not-allowed"
                          : ""
                      }
                      onClick={() => onResetPassword(employee)}
                      title={
                        isSelf
                          ? "Use Settings to change your own password"
                          : isStoreAdmin
                            ? "Protected Store Owner account"
                            : "Reset Password"
                      }
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(employee)}
                    title="Edit Employee"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cannotResetOrDelete}
                    onClick={() => onDelete(employee.id)}
                    title={
                      isSelf
                        ? "You cannot delete your own account"
                        : isStoreAdmin
                          ? "Protected Store Owner account"
                          : "Delete Employee"
                    }
                    className={
                      cannotResetOrDelete
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-red-600 hover:text-red-800"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default EmployeeTable;
