import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '../../../../utils/formateDate';

const getShiftDuration = (shiftStart, shiftEnd) => {
  if (!shiftStart) return '0m';
  const start = new Date(shiftStart);
  const end = shiftEnd ? new Date(shiftEnd) : new Date();
  const diffMs = Math.max(0, end - start);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const ShiftInformationCard = ({ shiftData }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Shift Information</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cashier:</span>
            <span className="font-medium">{shiftData.cashier?.fullName || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shift Start:</span>
            <span>{formatDateTime(shiftData.shiftStart)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shift End:</span>
            <span>{shiftData.shiftEnd ? formatDateTime(shiftData.shiftEnd) : 'ongoing'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span>{getShiftDuration(shiftData.shiftStart, shiftData.shiftEnd)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShiftInformationCard;