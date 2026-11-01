import React from "react";
import { useSelector } from "react-redux";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { DollarSign } from "lucide-react";

const RefundSpikeTable = () => {
  const { storeAlerts } = useSelector((state) => state.storeAnalytics);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Cashier Name</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="text-right">Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {storeAlerts?.refundSpike?.length > 0 ? (
          storeAlerts.refundSpike.map((branch) => (
            <TableRow key={branch.id}>
              <TableCell>{branch.id}</TableCell>
              <TableCell>
                <div className="font-medium">{branch.cashierName}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  {branch.amount}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <p>{branch.reason}</p>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
              No refund spikes detected.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default RefundSpikeTable;
