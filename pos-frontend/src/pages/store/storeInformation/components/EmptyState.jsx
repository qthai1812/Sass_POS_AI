import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Store, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const EmptyState = () => {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center h-64 p-6 text-center">
        <Store className="h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-xl font-medium text-gray-600 mb-2">No store information found</h3>
        <p className="text-gray-500 mb-4">Your store information will appear here once you initialize a store</p>
        <Button onClick={() => navigate("/auth/onboarding")} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" /> Create Store
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
