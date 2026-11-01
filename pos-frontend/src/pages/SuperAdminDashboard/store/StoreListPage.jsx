import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StoreTable from "./StoreTable";
import StoreDetailDrawer from "./StoreDetailDrawer";
import { useToast } from "@/components/ui/use-toast";
import { moderateStore } from "@/Redux Toolkit/features/store/storeThunks";

export default function StoreListPage() {
  const dispatch = useDispatch();
  const [selectedStore, setSelectedStore] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  const handleViewDetails = (store) => {
    setSelectedStore(store);
    setDrawerOpen(true);
  };

  const handleBlockStore = async (storeId) => {
    try {
      const updated = await dispatch(
        moderateStore({ storeId, action: "BLOCKED" })
      ).unwrap();
      if (selectedStore?.id === storeId) {
        setSelectedStore(updated);
      }
      toast({
        title: "Store Blocked",
        description: "The store status has been updated to BLOCKED.",
      });
    } catch (err) {
      toast({
        title: "Failed to Block Store",
        description: err || "An error occurred while blocking the store.",
        variant: "destructive",
      });
    }
  };

  const handleActivateStore = async (storeId) => {
    try {
      const updated = await dispatch(
        moderateStore({ storeId, action: "ACTIVE" })
      ).unwrap();
      if (selectedStore?.id === storeId) {
        setSelectedStore(updated);
      }
      toast({
        title: "Store Activated",
        description: "The store status has been updated to ACTIVE.",
      });
    } catch (err) {
      toast({
        title: "Failed to Activate Store",
        description: err || "An error occurred while activating the store.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stores</h2>
          <p className="text-muted-foreground">
            Manage all registered stores and their status
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Stores</CardTitle>
        </CardHeader>
        <CardContent>
          <StoreTable
            onViewDetails={handleViewDetails}
            onBlockStore={handleBlockStore}
            onActivateStore={handleActivateStore}
          />
        </CardContent>
      </Card>

      <StoreDetailDrawer
        store={selectedStore}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onBlockStore={handleBlockStore}
        onActivateStore={handleActivateStore}
      />
    </div>
  );
}
