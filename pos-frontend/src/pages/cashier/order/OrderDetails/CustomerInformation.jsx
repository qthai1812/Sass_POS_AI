import React from "react";
import { Card, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Star } from "lucide-react";

const CustomerInformation = ({ selectedOrder }) => {
  const customer = selectedOrder?.customer;
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold mb-2">Customer Information</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium">
              {customer?.fullName || "Walk-in Customer"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone:</span>
            <span>{customer?.phone || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email:</span>
            <span>{customer?.email || "N/A"}</span>
          </div>
          {customer && (
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-muted-foreground">Loyalty Points:</span>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 border-amber-500/30 flex items-center gap-1"
              >
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {customer.loyaltyPoints ?? 0} pts
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerInformation;
