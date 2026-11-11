import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Card } from "../../../components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import { ArrowRightLeft, Loader2, Lock } from "lucide-react";
import InactiveCashierTable from "./InactiveCashierTable";
import LowStockProductTable from "./LowStockProductTable";
import NoSaleTodayBranchTable from "./NoSaleTodayBranchTable";
import RefundSpikeTable from "./RefundSpikeTable";
import { useDispatch, useSelector } from "react-redux";
import { getStoreAlerts } from "../../../Redux Toolkit/features/storeAnalytics/storeAnalyticsThunks";
import { getAllBranchesByStore } from "../../../Redux Toolkit/features/branch/branchThunks";
import { getProductsByStore } from "../../../Redux Toolkit/features/product/productThunks";
import {
  getInventoryByBranch,
  transferInventory,
} from "../../../Redux Toolkit/features/inventory/inventoryThunks";

const Alerts = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const user = useSelector((state) => state.user.userProfile);
  const { store } = useSelector((state) => state.store);
  const { branches = [] } = useSelector((state) => state.branch);
  const { products = [] } = useSelector((state) => state.product);
  const { hasFeature, ready, loading: entLoading } = usePlanEntitlements();

  const storeId = store?.id || user?.storeId;
  const planBlocksTransfer =
    ready && (!hasFeature("inventory") || !hasFeature("multiLocation"));

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sourceInventories, setSourceInventories] = useState([]);
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (user?.id) {
      dispatch(getStoreAlerts(user.id));
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (transferOpen && storeId) {
      const jwt = localStorage.getItem("jwt");
      dispatch(getAllBranchesByStore({ storeId, jwt }));
      dispatch(getProductsByStore(storeId));
    }
  }, [dispatch, storeId, transferOpen]);

  useEffect(() => {
    let active = true;
    const loadSourceInventory = async () => {
      if (!transferOpen || !fromBranchId) {
        setSourceInventories([]);
        return;
      }
      setLoadingSourceStock(true);
      try {
        const list = await dispatch(
          getInventoryByBranch(Number(fromBranchId)),
        ).unwrap();
        if (active) {
          setSourceInventories(Array.isArray(list) ? list : []);
        }
      } catch {
        if (active) setSourceInventories([]);
      } finally {
        if (active) setLoadingSourceStock(false);
      }
    };
    loadSourceInventory();
    return () => {
      active = false;
    };
  }, [dispatch, fromBranchId, transferOpen]);

  const sourceStockMap = useMemo(() => {
    const map = {};
    (sourceInventories || []).forEach((inv) => {
      const pid = Number(inv.productId ?? inv.product?.id);
      if (pid) {
        map[pid] = (map[pid] || 0) + Number(inv.quantity ?? 0);
      }
    });
    return map;
  }, [sourceInventories]);

  const availableSourceStock = productId
    ? (sourceStockMap[Number(productId)] ?? 0)
    : null;
  const numericQty = Number(quantity);
  const isOverSourceStock =
    Boolean(fromBranchId && productId && !loadingSourceStock) &&
    numericQty > (availableSourceStock ?? 0);

  const resetForm = () => {
    setFromBranchId("");
    setToBranchId("");
    setProductId("");
    setQuantity("1");
    setSourceInventories([]);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!fromBranchId || !toBranchId || !productId) {
      toast({
        title: "Thiếu thông tin",
        description:
          "Vui lòng chọn đầy đủ chi nhánh nguồn, chi nhánh đích và sản phẩm.",
        variant: "destructive",
      });
      return;
    }
    if (String(fromBranchId) === String(toBranchId)) {
      toast({
        title: "Chi nhánh không hợp lệ",
        description: "Chi nhánh nguồn và chi nhánh đích phải khác nhau.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isInteger(numericQty) || numericQty <= 0) {
      toast({
        title: "Số lượng không hợp lệ",
        description: "Số lượng điều chuyển phải là số nguyên lớn hơn 0.",
        variant: "destructive",
      });
      return;
    }
    if (numericQty > (availableSourceStock ?? 0)) {
      toast({
        title: "Không đủ tồn kho nguồn",
        description: `Chi nhánh nguồn chỉ còn ${availableSourceStock ?? 0} sản phẩm khả dụng.`,
        variant: "destructive",
      });
      return;
    }

    setTransferring(true);
    try {
      await dispatch(
        transferInventory({
          productId: Number(productId),
          fromBranchId: Number(fromBranchId),
          toBranchId: Number(toBranchId),
          quantity: numericQty,
        }),
      ).unwrap();

      const fromName =
        branches.find((b) => String(b.id) === String(fromBranchId))?.name ||
        `CN #${fromBranchId}`;
      const toName =
        branches.find((b) => String(b.id) === String(toBranchId))?.name ||
        `CN #${toBranchId}`;
      const prodName =
        products.find((p) => String(p.id) === String(productId))?.name ||
        `SP #${productId}`;

      toast({
        title: "Điều chuyển tồn kho thành công",
        description: `Đã chuyển ${numericQty} "${prodName}" từ ${fromName} sang ${toName}.`,
      });
      setTransferOpen(false);
      resetForm();
      if (user?.id) {
        dispatch(getStoreAlerts(user.id));
      }
    } catch (err) {
      toast({
        title: "Điều chuyển thất bại",
        description: String(err || "Không thể điều chuyển tồn kho"),
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Store Alerts & Inventory Coordination
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi cảnh báo vận hành toàn chuỗi và điều phối tồn kho liên chi nhánh.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {planBlocksTransfer ? (
            <Button variant="outline" asChild className="gap-2">
              <Link to="/store/upgrade">
                <Lock className="w-4 h-4 text-amber-600" />
                Nâng cấp gói để điều chuyển kho
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                resetForm();
                setTransferOpen(true);
              }}
              disabled={!ready && entLoading}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Điều chuyển tồn kho liên chi nhánh
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="min-h-96 p-5">
          <h2 className="font-bold text-xl mb-4">Inactive Cashiers</h2>
          <InactiveCashierTable />
        </Card>

        <Card className="min-h-96 p-5">
          <h2 className="font-bold text-xl mb-4">Low Stock Alerts</h2>
          <LowStockProductTable />
        </Card>

        <Card className="min-h-96 p-5">
          <h2 className="font-bold text-xl mb-4">No Sale Today</h2>
          <NoSaleTodayBranchTable />
        </Card>

        <Card className="min-h-96 p-5">
          <h2 className="font-bold text-xl mb-4">Refund Spike</h2>
          <RefundSpikeTable />
        </Card>
      </div>

      <Dialog
        open={transferOpen}
        onOpenChange={(nextOpen) => {
          setTransferOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
              Điều chuyển hàng giữa các chi nhánh
            </DialogTitle>
            <DialogDescription>
              Chuyển tồn kho sản phẩm từ chi nhánh còn dư sang chi nhánh đang thiếu hàng trong cùng chuỗi cửa hàng.
            </DialogDescription>
          </DialogHeader>

          {branches.length < 2 ? (
            <div className="py-6 text-center space-y-2">
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Cần tối thiểu 2 chi nhánh
              </Badge>
              <p className="text-sm text-muted-foreground">
                Chuỗi cửa hàng hiện mới có {branches.length} chi nhánh. Vui lòng tạo thêm chi nhánh tại mục Branches trước khi điều chuyển kho.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chi nhánh nguồn</Label>
                  <Select
                    value={fromBranchId}
                    onValueChange={(val) => {
                      setFromBranchId(val);
                      if (val === toBranchId) {
                        setToBranchId("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chi nhánh xuất" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={String(branch.id)}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Chi nhánh đích</Label>
                  <Select
                    value={toBranchId}
                    onValueChange={setToBranchId}
                    disabled={!fromBranchId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chi nhánh nhận" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter((b) => String(b.id) !== String(fromBranchId))
                        .map((branch) => (
                          <SelectItem key={branch.id} value={String(branch.id)}>
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sản phẩm điều chuyển</Label>
                <Select
                  value={productId}
                  onValueChange={setProductId}
                  disabled={!fromBranchId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        fromBranchId
                          ? "Chọn sản phẩm"
                          : "Chọn chi nhánh nguồn trước"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length > 0 ? (
                      products.map((product) => {
                        const stock = sourceStockMap[Number(product.id)] ?? 0;
                        const outOfStock =
                          Boolean(fromBranchId) &&
                          !loadingSourceStock &&
                          stock <= 0;
                        return (
                          <SelectItem
                            key={product.id}
                            value={String(product.id)}
                            disabled={outOfStock}
                          >
                            {product.name}
                            {fromBranchId && !loadingSourceStock
                              ? ` (Tồn nguồn: ${stock})`
                              : ""}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        Không có sản phẩm
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-qty">Số lượng chuyển</Label>
                <Input
                  id="transfer-qty"
                  type="number"
                  min={1}
                  max={
                    availableSourceStock && availableSourceStock > 0
                      ? availableSourceStock
                      : undefined
                  }
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={
                    isOverSourceStock
                      ? "border-red-500 focus-visible:ring-red-500"
                      : ""
                  }
                  required
                />
                {fromBranchId && (
                  <p
                    className={`text-xs ${
                      isOverSourceStock || availableSourceStock === 0
                        ? "text-red-500 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {loadingSourceStock ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Đang kiểm tra tồn kho chi nhánh nguồn...
                      </span>
                    ) : productId ? (
                      availableSourceStock === 0 ? (
                        "Chi nhánh nguồn hiện hết tồn kho cho sản phẩm này."
                      ) : isOverSourceStock ? (
                        `Vượt quá tồn kho khả dụng (Tối đa: ${availableSourceStock}).`
                      ) : (
                        `Tồn kho khả dụng tại chi nhánh nguồn: ${availableSourceStock} sản phẩm.`
                      )
                    ) : (
                      "Chọn sản phẩm để kiểm tra tồn kho khả dụng."
                    )}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={
                    transferring ||
                    loadingSourceStock ||
                    !fromBranchId ||
                    !toBranchId ||
                    !productId ||
                    isOverSourceStock ||
                    availableSourceStock === 0
                  }
                >
                  {transferring ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang điều chuyển...
                    </>
                  ) : (
                    "Xác nhận điều chuyển"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
