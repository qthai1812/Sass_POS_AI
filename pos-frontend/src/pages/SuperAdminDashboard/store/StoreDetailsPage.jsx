import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  Ban,
  CheckCircle,
} from "lucide-react";
import {
  getStoreById,
  moderateStore,
} from "../../../Redux Toolkit/features/store/storeThunks";
import StoreStatusBadge from "./StoreStatusBadge";
import { formatDateTime } from "../../../utils/formateDate";
import { useToast } from "../../../components/ui/use-toast";

export default function StoreDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { store, loading, error } = useSelector((state) => state.store);

  useEffect(() => {
    if (id) {
      dispatch(getStoreById(id));
    }
  }, [dispatch, id]);

  const handleStatusChange = async (action) => {
    try {
      await dispatch(moderateStore({ storeId: id, action })).unwrap();
      dispatch(getStoreById(id));
      toast({
        title: "Status Updated",
        description: `Store status has been changed to ${action}.`,
      });
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err || "Failed to update store status",
        variant: "destructive",
      });
    }
  };

  const upperStatus = store?.status?.toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/super-admin/stores")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stores
        </Button>

        {store && (
          <div className="flex items-center gap-2">
            {upperStatus !== "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("ACTIVE")}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Activate Store
              </Button>
            )}
            {upperStatus !== "BLOCKED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange("BLOCKED")}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Ban className="w-4 h-4 mr-1" />
                Block Store
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">Loading store details...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : !store ? (
        <div className="text-center py-8 text-muted-foreground">
          Store not found.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {store.brand}
              </h2>
              <p className="text-muted-foreground">
                Store ID: #{store.id} • {store.storeType || "Retail Store"}
              </p>
            </div>
            <StoreStatusBadge status={store.status} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
                  <span className="font-medium">
                    {store.storeAdmin?.fullName || "-"}
                  </span>
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
                  <Building className="w-5 h-5" />
                  Store Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {store.contact?.address || "Address not provided"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Registered on {formatDateTime(store.createdAt)}</span>
                </div>
                {store.description && (
                  <p className="text-sm text-muted-foreground pt-2 border-t">
                    {store.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
