import { useSelector } from "react-redux";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { LocationEdit } from "lucide-react";

const NoSaleTodayBranchTable = () => {
  const { storeAlerts, loading } = useSelector((state) => state.storeAnalytics);

  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center py-8">
              <div className="flex justify-center items-center">
                <svg
                  className="animate-spin h-6 w-6 text-emerald-600 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Loading branches...
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch Name</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead>Phone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {storeAlerts?.noSaleToday?.length > 0 ? (
          storeAlerts.noSaleToday.map((branch) => (
            <TableRow key={branch.id}>
              <TableCell>
                <div className="font-medium">{branch.name}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <LocationEdit className="h-4 w-4 text-gray-400" />
                  {branch.address}
                </div>
              </TableCell>
              <TableCell>
                {branch.manager?.fullName ||
                  branch.manager ||
                  "Assigned via Branch"}
              </TableCell>
              <TableCell>{branch.phone || "N/A"}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={4}
              className="text-center py-8 text-muted-foreground"
            >
              No branches found with zero sales today.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default NoSaleTodayBranchTable;