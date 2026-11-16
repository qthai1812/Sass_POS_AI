import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import {
  ArrowRightLeft,
  Boxes,
  AlertTriangle,
  PackageX,
  PackageCheck,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import DataTablePagination from "@/components/ui/data-table-pagination";
import FeatureGate from "@/components/FeatureGate";
import { useToast } from "@/components/ui/use-toast";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";
import { getAllBranchesByStore } from "@/Redux Toolkit/features/branch/branchThunks";
import { getProductsByStore } from "@/Redux Toolkit/features/product/productThunks";
import { getCategoriesByStore } from "@/Redux Toolkit/features/category/categoryThunks";
import {
  getInventoryByBranch,
  getInventoryByBranchPaged,
  getInventorySummaryByBranch,
  transferInventory,
} from "@/Redux Toolkit/features/inventory/inventoryThunks";
import {
  buildStockLookupMap,
  computeTransferPreview,
  resolveInventoryProductInfo,
  validateInventoryTransfer,
} from "./inventoryTransferUtils";

function StoreInventoryTransferWorkspace() {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const user = useSelector((state) => state.user?.userProfile);
  const { store } = useSelector((state) => state.store || {});
  const { branches = [], loading: branchesLoading } = useSelector(
    (state) => state.branch || {},
  );
  const { products = [] } = useSelector((state) => state.product || {});
  const { categories = [] } = useSelector((state) => state.category || {});
  const {
    pagedInventories,
    pagedLoading: tableLoading,
    inventorySummary,
  } = useSelector((state) => state.inventory || {});

  const storeId = store?.id || user?.storeId;

  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [sourceInventories, setSourceInventories] = useState([]);
  const [targetInventories, setTargetInventories] = useState([]);
  const [loadingSourceStock, setLoadingSourceStock] = useState(false);
  const [loadingTargetStock, setLoadingTargetStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentTransfers, setRecentTransfers] = useState([]);

  // Tải danh sách chi nhánh, sản phẩm và danh mục toàn chuỗi
  useEffect(() => {
    if (!storeId) return;
    const token = localStorage.getItem("jwt");
    dispatch(getAllBranchesByStore({ storeId, jwt: token }));
    dispatch(getProductsByStore(storeId));
    dispatch(getCategoriesByStore({ storeId, token }));
  }, [dispatch, storeId]);

  // Tự động chọn sẵn cặp chi nhánh mặc định nếu chuỗi có >= 2 chi nhánh
  useEffect(() => {
    if (!Array.isArray(branches) || branches.length < 2) return;
    const validIds = new Set(branches.map((b) => String(b.id)));
    const nextFrom =
      fromBranchId && validIds.has(String(fromBranchId))
        ? String(fromBranchId)
        : String(branches[0].id);

    let nextTo =
      toBranchId && validIds.has(String(toBranchId)) ? String(toBranchId) : "";
    if (!nextTo || nextTo === nextFrom) {
      const alt = branches.find((b) => String(b.id) !== nextFrom);
      nextTo = alt ? String(alt.id) : "";
    }

    if (nextFrom !== fromBranchId) setFromBranchId(nextFrom);
    if (nextTo !== toBranchId) setToBranchId(nextTo);
  }, [branches, fromBranchId, toBranchId]);

  // Debounce từ khóa tìm kiếm trước khi gọi API phân trang
  useEffect(() => {
    const next = searchTerm.trim();
    if (next === debouncedKeyword) return;
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedKeyword(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedKeyword]);

  const fetchSourcePagedAndSummary = useCallback(() => {
    if (!fromBranchId) return Promise.resolve();
    const numericBranchId = Number(fromBranchId);
    return Promise.all([
      dispatch(
        getInventoryByBranchPaged({
          branchId: numericBranchId,
          keyword: debouncedKeyword,
          category: categoryFilter,
          page,
          size: pageSize,
          sortBy: "lastUpdate",
          sortDir: "desc",
        }),
      ),
      dispatch(
        getInventorySummaryByBranch({
          branchId: numericBranchId,
          keyword: debouncedKeyword,
          category: categoryFilter,
        }),
      ),
    ]);
  }, [dispatch, fromBranchId, debouncedKeyword, categoryFilter, page, pageSize]);

  useEffect(() => {
    fetchSourcePagedAndSummary();
  }, [fetchSourcePagedAndSummary]);

  const loadBranchStockSnapshot = useCallback(
    async (branchId, setList, setLoading) => {
      if (!branchId) {
        setList([]);
        return;
      }
      setLoading(true);
      try {
        const list = await dispatch(
          getInventoryByBranch(Number(branchId)),
        ).unwrap();
        setList(Array.isArray(list) ? list : []);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    loadBranchStockSnapshot(
      fromBranchId,
      setSourceInventories,
      setLoadingSourceStock,
    );
  }, [fromBranchId, loadBranchStockSnapshot]);

  useEffect(() => {
    loadBranchStockSnapshot(
      toBranchId,
      setTargetInventories,
      setLoadingTargetStock,
    );
  }, [toBranchId, loadBranchStockSnapshot]);

  const sourceStockMap = useMemo(
    () => buildStockLookupMap(sourceInventories),
    [sourceInventories],
  );

  const targetStockMap = useMemo(
    () => buildStockLookupMap(targetInventories),
    [targetInventories],
  );

  const tableRows = useMemo(() => {
    const pagedRows = pagedInventories?.content || [];
    return pagedRows.map((inv) =>
      resolveInventoryProductInfo(inv, products, categories),
    );
  }, [pagedInventories?.content, products, categories]);

  const selectedProduct = useMemo(() => {
    if (!productId) return null;
    const pid = Number(productId);
    const inPage = tableRows.find((r) => r.productId === pid);
    if (inPage) return inPage;
    const inCatalog = products.find((p) => Number(p.id) === pid);
    if (!inCatalog) return null;
    return resolveInventoryProductInfo(
      { productId: pid, product: inCatalog, quantity: sourceStockMap[pid] ?? 0 },
      products,
      categories,
    );
  }, [productId, tableRows, products, categories, sourceStockMap]);

  const availableSourceStock = productId
    ? (sourceStockMap[Number(productId)] ?? 0)
    : 0;
  const currentTargetStock = productId
    ? (targetStockMap[Number(productId)] ?? 0)
    : 0;

  const preview = useMemo(
    () =>
      computeTransferPreview({
        availableSourceStock,
        currentTargetStock,
        quantity,
      }),
    [availableSourceStock, currentTargetStock, quantity],
  );

  const validation = useMemo(
    () =>
      validateInventoryTransfer({
        branchCount: branches.length,
        fromBranchId,
        toBranchId,
        productId,
        quantity,
        availableSourceStock,
        loadingSourceStock,
      }),
    [
      branches.length,
      fromBranchId,
      toBranchId,
      productId,
      quantity,
      availableSourceStock,
      loadingSourceStock,
    ],
  );

  const fromBranchName =
    branches.find((b) => String(b.id) === String(fromBranchId))?.name ||
    "Chi nhánh nguồn";
  const toBranchName =
    branches.find((b) => String(b.id) === String(toBranchId))?.name ||
    "Chi nhánh đích";

  const handleSwapBranches = () => {
    if (!fromBranchId || !toBranchId) return;
    setPage(0);
    setFromBranchId(toBranchId);
    setToBranchId(fromBranchId);
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchSourcePagedAndSummary(),
        loadBranchStockSnapshot(
          fromBranchId,
          setSourceInventories,
          setLoadingSourceStock,
        ),
        loadBranchStockSnapshot(
          toBranchId,
          setTargetInventories,
          setLoadingTargetStock,
        ),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickQuantity = (presetQty) => {
    if (!availableSourceStock || availableSourceStock <= 0) return;
    const clamped = Math.max(1, Math.min(presetQty, availableSourceStock));
    setQuantity(String(clamped));
  };

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!validation.valid) {
      toast({
        title: validation.errorTitle,
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }

    const numericQty = Number(quantity);
    setSubmitting(true);
    try {
      await dispatch(
        transferInventory({
          productId: Number(productId),
          fromBranchId: Number(fromBranchId),
          toBranchId: Number(toBranchId),
          quantity: numericQty,
        }),
      ).unwrap();

      const productName = selectedProduct?.name || `SP #${productId}`;
      const productSku = selectedProduct?.sku || `SKU-${productId}`;

      toast({
        title: "Điều chuyển tồn kho thành công",
        description: `Đã chuyển ${numericQty} "${productName}" từ ${fromBranchName} sang ${toBranchName}.`,
      });

      setRecentTransfers((prev) => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          productName,
          productSku,
          fromBranchName,
          toBranchName,
          quantity: numericQty,
        },
        ...prev.slice(0, 5),
      ]);

      setQuantity("1");
      await handleRefreshAll();
    } catch (err) {
      toast({
        title: "Điều chuyển thất bại",
        description: String(err || "Không thể điều chuyển tồn kho liên chi nhánh"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Điều chuyển tồn kho liên chi nhánh
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Đối chiếu tồn kho theo từng chi nhánh và thực hiện điều phối hàng hóa nội bộ theo thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={refreshing || !fromBranchId}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Làm mới số liệu
          </Button>
          <Button variant="outline" asChild>
            <Link to="/store/alerts">Xem cảnh báo kho</Link>
          </Button>
        </div>
      </div>

      {!branchesLoading && branches.length < 2 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Chưa đủ chi nhánh để điều chuyển nội bộ</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span>
              Chuỗi cửa hàng hiện mới có {branches.length} chi nhánh. Cần tối thiểu 2 chi nhánh để điều phối hàng hóa liên chi nhánh.
            </span>
            <Button size="sm" asChild>
              <Link to="/store/branches">Quản lý chi nhánh</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Thanh chọn cặp chi nhánh nguồn <-> đích */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
                <div className="md:col-span-5 space-y-2">
                  <Label>Chi nhánh nguồn (Xuất kho)</Label>
                  <Select
                    value={fromBranchId}
                    onValueChange={(val) => {
                      setPage(0);
                      setFromBranchId(val);
                      if (val === toBranchId) {
                        const alt = branches.find(
                          (b) => String(b.id) !== String(val),
                        );
                        setToBranchId(alt ? String(alt.id) : "");
                      }
                    }}
                  >
                    <SelectTrigger className="w-full [&>span]:truncate">
                      <SelectValue placeholder="Chọn chi nhánh nguồn" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSwapBranches}
                    disabled={!fromBranchId || !toBranchId}
                    title="Hoán đổi chi nhánh nguồn và chi nhánh đích"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                  </Button>
                </div>

                <div className="md:col-span-5 space-y-2">
                  <Label>Chi nhánh đích (Nhập kho)</Label>
                  <Select value={toBranchId} onValueChange={setToBranchId}>
                    <SelectTrigger className="w-full [&>span]:truncate">
                      <SelectValue placeholder="Chọn chi nhánh đích" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter((b) => String(b.id) !== String(fromBranchId))
                        .map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4 Thẻ thống kê nhanh tại chi nhánh nguồn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tổng SKU tại chi nhánh nguồn</CardDescription>
                <CardTitle className="text-2xl flex items-center justify-between">
                  <span>
                    {Number(inventorySummary?.totalItems || 0).toLocaleString("vi-VN")}
                  </span>
                  <Boxes className="w-5 h-5 text-emerald-600" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tổng sản phẩm khả dụng</CardDescription>
                <CardTitle className="text-2xl flex items-center justify-between">
                  <span>
                    {Number(inventorySummary?.totalQuantity || 0).toLocaleString("vi-VN")}
                  </span>
                  <PackageCheck className="w-5 h-5 text-blue-600" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>SKU sắp hết tại nguồn</CardDescription>
                <CardTitle className="text-2xl flex items-center justify-between text-amber-600">
                  <span>
                    {Number(inventorySummary?.lowStockCount || 0).toLocaleString("vi-VN")}
                  </span>
                  <AlertTriangle className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>SKU đã hết hàng tại nguồn</CardDescription>
                <CardTitle className="text-2xl flex items-center justify-between text-red-600">
                  <span>
                    {Number(inventorySummary?.outOfStockCount || 0).toLocaleString("vi-VN")}
                  </span>
                  <PackageX className="w-5 h-5" />
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Không gian làm việc 2 cột: Bảng tồn kho đối chiếu + Phiếu điều chuyển */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <Card className="xl:col-span-8">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  Tồn kho chi nhánh nguồn: {fromBranchName}
                </CardTitle>
                <CardDescription>
                  Chọn một mặt hàng từ bảng bên dưới để điền nhanh vào phiếu điều chuyển.
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={categoryFilter}
                    onValueChange={(val) => {
                      setPage(0);
                      setCategoryFilter(val);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Tất cả danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả danh mục</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[96px]">SKU</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Tồn nguồn</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Tồn đích</TableHead>
                      <TableHead className="text-right pr-4 whitespace-nowrap">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                          Đang tải danh sách tồn kho...
                        </TableCell>
                      </TableRow>
                    ) : tableRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          Không tìm thấy dữ liệu tồn kho phù hợp bộ lọc.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableRows.map((row) => {
                        const targetQty =
                          toBranchId && !loadingTargetStock
                            ? (targetStockMap[row.productId] ?? 0)
                            : null;
                        const isSelected =
                          String(row.productId) === String(productId);
                        const isOut = row.quantity <= 0;
                        const isLow = row.quantity > 0 && row.quantity <= row.minStockLevel;

                        return (
                          <TableRow
                            key={row.id}
                            className={isSelected ? "bg-emerald-500/10" : undefined}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {row.sku}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{row.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.category}
                                {row.size ? ` · Size ${row.size}` : ""}
                                {row.color ? ` · ${row.color}` : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={
                                  isOut
                                    ? "border-red-300 text-red-600"
                                    : isLow
                                      ? "border-amber-300 text-amber-600"
                                      : "border-emerald-300 text-emerald-700"
                                }
                              >
                                {row.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium text-muted-foreground">
                              {loadingTargetStock ? "..." : targetQty ?? "-"}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <Button
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className={
                                  isSelected
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : ""
                                }
                                disabled={isOut}
                                onClick={() => {
                                  setProductId(String(row.productId));
                                  setQuantity("1");
                                }}
                              >
                                {isSelected ? "Đang chọn" : "Chọn chuyển"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={pagedInventories?.pageNumber ?? page}
                  pageSize={pagedInventories?.pageSize ?? pageSize}
                  totalElements={pagedInventories?.totalElements ?? 0}
                  totalPages={pagedInventories?.totalPages ?? 0}
                  currentCount={tableRows.length}
                  itemLabel="sản phẩm"
                  loading={tableLoading}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPageSize(nextSize);
                    setPage(0);
                  }}
                />
              </CardContent>
            </Card>

            {/* Cột phải: Phiếu điều chuyển & Lịch sử phiên */}
            <div className="xl:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                    Phiếu điều chuyển liên chi nhánh
                  </CardTitle>
                  <CardDescription>
                    Thao tác trừ kho nguồn và cộng kho đích trong một giao dịch nguyên tử.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitTransfer} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Sản phẩm điều chuyển</Label>
                      <Select
                        value={productId}
                        onValueChange={(val) => {
                          setProductId(val);
                          setQuantity("1");
                        }}
                        disabled={!fromBranchId}
                      >
                        <SelectTrigger className="w-full [&>span]:truncate">
                          <SelectValue placeholder="Chọn sản phẩm từ danh mục" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.length > 0 ? (
                            products.map((p) => {
                              const stock = sourceStockMap[Number(p.id)] ?? 0;
                              const disabledItem =
                                Boolean(fromBranchId) &&
                                !loadingSourceStock &&
                                stock <= 0;
                              return (
                                <SelectItem
                                  key={p.id}
                                  value={String(p.id)}
                                  disabled={disabledItem}
                                >
                                  {p.name}
                                  {fromBranchId && !loadingSourceStock
                                    ? ` (Tồn nguồn: ${stock})`
                                    : ""}
                                </SelectItem>
                              );
                            })
                          ) : (
                            <SelectItem value="none" disabled>
                              Không có sản phẩm nào
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="workspace-transfer-qty">Số lượng điều chuyển</Label>
                        {productId && !loadingSourceStock && (
                          <span className="text-xs text-muted-foreground">
                            Tối đa: {availableSourceStock} sản phẩm
                          </span>
                        )}
                      </div>
                      <Input
                        id="workspace-transfer-qty"
                        type="number"
                        min={1}
                        max={availableSourceStock > 0 ? availableSourceStock : undefined}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                      />
                      {productId && availableSourceStock > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {[5, 10, 20].map((preset) => (
                            <Button
                              key={preset}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={availableSourceStock < 1}
                              onClick={() => handleQuickQuantity(preset)}
                            >
                              {preset}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              handleQuickQuantity(Math.max(1, Math.floor(availableSourceStock / 2)))
                            }
                          >
                            50% ({Math.max(1, Math.floor(availableSourceStock / 2))})
                          </Button>
                        </div>
                      )}
                    </div>

                    {productId && (
                      <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
                        <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                          Dự kiến biến động tồn kho
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{fromBranchName}:</span>
                          <span className="font-semibold">
                            {availableSourceStock}{" "}
                            <ArrowRight className="inline w-3.5 h-3.5 mx-1 text-red-500" />{" "}
                            <span className="text-red-600">{preview.nextSourceStock}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{toBranchName}:</span>
                          <span className="font-semibold">
                            {loadingTargetStock ? "..." : currentTargetStock}{" "}
                            <ArrowRight className="inline w-3.5 h-3.5 mx-1 text-emerald-600" />{" "}
                            <span className="text-emerald-600">
                              {loadingTargetStock ? "..." : preview.nextTargetStock}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}

                    {!validation.valid && productId && (
                      <p className="text-xs text-red-500 font-medium">
                        {validation.errorMessage}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={submitting || !validation.valid}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang xử lý điều chuyển...
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Xác nhận điều chuyển
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {recentTransfers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Giao dịch vừa thực hiện
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentTransfers.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-2 text-sm border-b last:border-b-0 pb-2 last:pb-0"
                      >
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.fromBranchName} → {item.toBranchName} · {item.time}
                          </div>
                        </div>
                        <Badge className="bg-emerald-600 shrink-0">
                          +{item.quantity}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StoreInventoryTransfer() {
  return (
    <FeatureGate feature="inventory" title="Quản lý & Điều chuyển tồn kho">
      <FeatureGate
        feature="multiLocation"
        title="Điều chuyển tồn kho liên chi nhánh"
      >
        <StoreInventoryTransferWorkspace />
      </FeatureGate>
    </FeatureGate>
  );
}
