import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarIcon, PlusIcon, Loader2, UserIcon, Award } from "lucide-react";

export const getLoyaltyTier = (points = 0) => {
  const pts = Number(points || 0);
  if (pts >= 200) {
    return {
      label: "Diamond",
      className: "bg-purple-100 text-purple-800 border-purple-300",
    };
  }
  if (pts >= 100) {
    return {
      label: "Gold",
      className: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }
  if (pts >= 30) {
    return {
      label: "Silver",
      className: "bg-slate-200 text-slate-800 border-slate-300",
    };
  }
  return {
    label: "Member",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
};

const CustomerDetails = ({ customer, onAddPoints, loading = false }) => {
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
        <UserIcon size={48} strokeWidth={1} />
        <p className="mt-4">Select a customer to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
        <Loader2 className="animate-spin h-8 w-8 mb-4" />
        <p>Loading customer details...</p>
      </div>
    );
  }

  const pts = Number(customer.loyaltyPoints || 0);
  const tier = getLoyaltyTier(pts);

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">
              {customer.fullName || customer.name || "Unknown Customer"}
            </h2>
            <Badge variant="outline" className={tier.className}>
              <Award className="w-3.5 h-3.5 mr-1" />
              {tier.label}
            </Badge>
          </div>
          <p className="text-muted-foreground">{customer.phone || "N/A"}</p>
          <p className="text-muted-foreground">{customer.email || "N/A"}</p>
        </div>
        <Button onClick={onAddPoints} className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          Add Points
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Loyalty Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StarIcon className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="text-2xl font-bold">{pts}</span>
            </div>
            <p className="text-xs text-amber-600 font-medium mt-1">
              Quy đổi: {(pts * 1000).toLocaleString("vi-VN")}₫
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {customer.totalOrders || 0}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              ₫{Number(customer.totalSpent || 0).toLocaleString("vi-VN")}
            </span>
          </CardContent>
        </Card>
      </div>

      {customer.averageOrderValue > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              ₫{Number(customer.averageOrderValue || 0).toLocaleString("vi-VN")}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerDetails;
