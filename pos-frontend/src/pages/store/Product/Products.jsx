import React, { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getProductsByStorePaged } from "@/Redux Toolkit/features/product/productThunks";
import DataTablePagination from "@/components/ui/data-table-pagination";
import { DEFAULT_PAGE_SIZE } from "@/utils/paginationUtils";
import { toast } from "@/components/ui/use-toast";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import ProductTable from "./ProductTable";
import ProductForm from "./ProductForm";
import ProductSearch from "./ProductSearch";
import ProductDetails from "./ProductDetails";

export default function Products() {
  const dispatch = useDispatch();
  const { pagedProducts, pagedLoading: loading, error } = useSelector(
    (state) => state.product,
  );
  const displayedProducts = pagedProducts?.content || [];
  const { store } = useSelector((state) => state.store);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const { entitlements, refresh: refreshEntitlements } = usePlanEntitlements();
  const isProductLimitReached =
    entitlements?.maxProducts != null &&
    entitlements?.usedProducts >= entitlements?.maxProducts;
  const isSearchActive = Boolean(debouncedKeyword);

  useEffect(() => {
    const next = searchQuery.trim();
    if (next === debouncedKeyword) return;
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedKeyword(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedKeyword]);

  const fetchProducts = useCallback(async () => {
    if (!store?.id) return;
    try {
      await dispatch(
        getProductsByStorePaged({
          storeId: store.id,
          keyword: debouncedKeyword,
          page,
          size: pageSize,
          sortBy: "createdAt",
          sortDir: "desc",
        }),
      ).unwrap();
    } catch (err) {
      toast({
        title: "Error",
        description: err || "Failed to fetch products",
        variant: "destructive",
      });
    }
  }, [dispatch, store?.id, debouncedKeyword, page, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const handleAddProductSuccess = () => {
    setIsAddDialogOpen(false);
    refreshEntitlements();
    if (page !== 0) {
      setPage(0);
    } else {
      fetchProducts();
    }
  };

  const handleEditProductSuccess = () => {
    setIsEditDialogOpen(false);
    setCurrentProduct(null);
    fetchProducts();
  };

  const handleProductDeleted = () => {
    refreshEntitlements();
    if (displayedProducts.length === 1 && page > 0) {
      setPage((prev) => Math.max(0, prev - 1));
    } else {
      fetchProducts();
    }
  };

  const openEditDialog = (product) => {
    setCurrentProduct(product);
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (product) => {
    setCurrentProduct(product);
    setIsViewDialogOpen(true);
  };

  const handleSearchSubmit = (kw) => {
    const next = kw ? String(kw).trim() : "";
    if (next !== debouncedKeyword) {
      setPage(0);
      setDebouncedKeyword(next);
    }
    if (!next) {
      setSearchQuery("");
    }
  };

  const handlePageSizeChange = (nextSize) => {
    setPageSize(nextSize);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Product Management
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isProductLimitReached}
              title={isProductLimitReached ? "Đã đạt giới hạn sản phẩm của gói cước" : ""}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Product
              {entitlements?.maxProducts ? ` (${entitlements.usedProducts}/${entitlements.maxProducts})` : ""}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto p-10">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <ProductForm
              onSubmit={handleAddProductSuccess}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <ProductSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={handleSearchSubmit}
          isSearching={loading}
        />

        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isSearchActive && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-md flex justify-between items-center">
          <span>
            Showing search results for "{debouncedKeyword}" ({pagedProducts?.totalElements ?? displayedProducts.length}{" "}
            {(pagedProducts?.totalElements ?? displayedProducts.length) === 1 ? "product" : "products"} found)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSearchSubmit(null)}
            className="text-amber-800 hover:text-amber-900 hover:bg-amber-100"
          >
            Show all products
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ProductTable
            products={displayedProducts}
            loading={loading || refreshing}
            onEdit={openEditDialog}
            onView={openViewDialog}
            onDeleted={handleProductDeleted}
          />
        </CardContent>
        <DataTablePagination
          page={pagedProducts?.pageNumber ?? page}
          pageSize={pagedProducts?.pageSize ?? pageSize}
          totalElements={pagedProducts?.totalElements ?? 0}
          totalPages={pagedProducts?.totalPages ?? 0}
          currentCount={displayedProducts.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading || refreshing}
          itemLabel="products"
        />
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <ProductForm
            initialValues={currentProduct}
            onSubmit={handleEditProductSuccess}
            onCancel={() => setIsEditDialogOpen(false)}
            isEditing={true}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          <ProductDetails product={currentProduct} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
