import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import {
  Store,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Building,
  Ban,
  CheckCircle,
} from "lucide-react";
import StoreStatusBadge from "./StoreStatusBadge";
import { formatDateTime } from "../../../utils/formateDate";

export default function StoreDetailDrawer({
  store,
  open,
  onOpenChange,
  onBlockStore,
  onActivateStore,
}) {
  if (!store) return null;

  const upperStatus = store.status?.toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div>
            <SheetTitle className="text-xl font-bold">{store.brand}</SheetTitle>
            <SheetDescription>Store ID: #{store.id}</SheetDescription>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <StoreStatusBadge status={store.status} />
            <div className="flex gap-2">
              {upperStatus !== "BLOCKED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBlockStore?.(store.id)}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Block Store
                </Button>
              )}
              {upperStatus !== "ACTIVE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActivateStore?.(store.id)}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Activate Store
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Owner Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{store.storeAdmin?.fullName || "-"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{store.contact?.phone || "-"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{store.contact?.email || "-"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="w-5 h-5" />
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{store.brand}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{store.contact?.address || store.address || "Address not provided"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Registered on {formatDateTime(store.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
