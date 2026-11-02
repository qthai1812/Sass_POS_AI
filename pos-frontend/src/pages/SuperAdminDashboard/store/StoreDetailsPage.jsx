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
  Trash2,
} from "lucide-react";
import {
  getStoreById,
  moderateStore,
  deleteStore,
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

  const handleDeleteStore = async () => {
    if (!store?.id) return;
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa vĩnh viễn cửa hàng "${store.brand}" (#${store.id})?\nToàn bộ chi nhánh, sản phẩm và đơn hàng của cửa hàng này sẽ bị xóa!`
    );
    if (!confirmDelete) return;
    try {
      await dispatch(deleteStore(store.id)).unwrap();
      toast({
        title: "Đã xóa cửa hàng",
        description: `Cửa hàng "${store.brand}" đã được xóa thành công.`,
      });
      navigate("/super-admin/stores");
    } catch (err) {
      toast({
        title: "Không thể xóa cửa hàng",
        description: typeof err === "string" ? err : "Lỗi khi xóa cửa hàng",
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
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
              >
                <Ban className="w-4 h-4 mr-1" />
                Block Store
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteStore}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Store
            </Button>
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
            {/* Store Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Store Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Brand Name</p>
                    <p className="font-medium">{store.brand}</p>
                  </div>
                </div>

                {store.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{store.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Registered</p>
                    <p className="font-medium">
                      {formatDateTime(store.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Store Admin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {store.storeAdmin?.fullName || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">
                      {store.storeAdmin?.email ||
                        store.contact?.email ||
                        "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">
                      {store.contact?.phone ||
                        store.storeAdmin?.phone ||
                        "-"}
                    </p>
                  </div>
                </div>

                {store.contact?.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{store.contact.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
