import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Mail, Phone, MapPin, UserX, UserCheck } from "lucide-react";

const EmployeeTable = ({
  employees,
  currentUser,
  branches,
  onToggleAccess,
  onEdit,
  onDelete,
}) => {
  if (!employees || employees.length === 0) {
    return <div className="text-center py-8 text-gray-500">No employees found.</div>;
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
              employee.role === "ROLE_STORE_ADMIN" ||
              employee.role === "ROLE_ADMIN";
            const cannotDisable = hasAccess && Boolean(isSelf || isStoreAdmin);

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
                <TableCell>{employee.role}</TableCell>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(employee)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(isSelf || isStoreAdmin)}
                    onClick={() => onDelete(employee.id)}
                    className={
                      isSelf || isStoreAdmin
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