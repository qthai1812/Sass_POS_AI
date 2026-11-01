import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Barcode, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ProductCard from "./ProductCard";
import { useDispatch, useSelector } from "react-redux";
import {
  getProductsByStore,
  searchProducts,
} from "../../../Redux Toolkit/features/product/productThunks";
import { getBranchById } from "../../../Redux Toolkit/features/branch/branchThunks";
import { getInventoryByBranch } from "../../../Redux Toolkit/features/inventory/inventoryThunks";
import { clearSearchResults } from "@/Redux Toolkit/features/product/productSlice";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";

const ProductSection = ({ searchInputRef }) => {
  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { inventories = [] } = useSelector((state) => state.inventory || {});
  const [searchTerm, setSearchTerm] = useState("");
  const {
    products,
    searchResults,
    loading,
    error: productsError,
  } = useSelector((state) => state.product);

  const { toast } = useToast();
  // Gói cước không có Inventory System: bán hàng không bị ràng buộc bởi tồn kho
  const { hasFeature } = usePlanEntitlements();
  const trackStock = hasFeature("inventory");

  // Gom tồn kho của chi nhánh hiện tại theo productId
  const inventoryMap = useMemo(() => {
    const map = {};
    (inventories || []).forEach((inv) => {
      const pid = inv.productId ?? inv.product?.id;
      if (pid != null) {
        map[pid] = (map[pid] || 0) + Number(inv.quantity ?? 0);
      }
    });
    return map;
  }, [inventories]);

  const getDisplayProducts = () => {
    if (searchTerm.trim() && searchResults.length > 0) {
      return searchResults;
    }
    if (searchTerm.trim()) {
      return (products || []).filter(
        (p) =>
          p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }
    return products || [];
  };

  // Tải đồng thời sản phẩm của Store và tồn kho của Chi nhánh hiện tại
  useEffect(() => {
    const fetchProductsAndInventory = async () => {
      const activeBranchId = branch?.id || userProfile?.branchId;

      if (branch?.storeId && localStorage.getItem("jwt")) {
        try {
          await Promise.all([
            dispatch(getProductsByStore(branch.storeId)).unwrap(),
            activeBranchId
              ? dispatch(getInventoryByBranch(activeBranchId)).unwrap()
              : Promise.resolve(),
          ]);
        } catch (error) {
          toast({
            title: "Error",
            description: error || "Failed to fetch products or branch stock",
            variant: "destructive",
          });
        }
      } else if (
        userProfile?.branchId &&
        localStorage.getItem("jwt") &&
        !branch
      ) {
        try {
          await dispatch(
            getBranchById({
              id: userProfile.branchId,
              jwt: localStorage.getItem("jwt"),
            }),
          ).unwrap();
        } catch {
          toast({
            title: "Error",
            description: "Failed to load branch information",
            variant: "destructive",
          });
        }
      }
    };

    fetchProductsAndInventory();
  }, [dispatch, branch, userProfile, toast]);

  const debounceTimeoutRef = useRef(null);

  const debouncedSearch = useCallback(
    (query) => {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        if (query.trim() && branch?.storeId && localStorage.getItem("jwt")) {
          dispatch(
            searchProducts({
              query: query.trim(),
              storeId: branch.storeId,
            }),
          )
            .unwrap()
            .catch((error) => {
              toast({
                title: "Search Error",
                description: error || "Failed to search products",
                variant: "destructive",
              });
            });
        }
      }, 350);
    },
    [dispatch, branch, toast],
  );

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (e.target.value.trim()) {
      debouncedSearch(e.target.value);
    } else {
      dispatch(clearSearchResults());
    }
  };

  useEffect(() => {
    if (productsError) {
      toast({
        title: "Error",
        description: productsError,
        variant: "destructive",
      });
    }
  }, [productsError, toast]);

  return (
    <div className="w-full flex flex-col bg-card border-r h-full">
      <div className="p-4 border-b bg-muted">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search products or scan barcode (F1 / F2)"
            className="pl-10 pr-4 py-3 text-base"
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-muted-foreground">
            {loading
              ? "Loading products..."
              : searchTerm.trim()
                ? `Search results: ${getDisplayProducts().length} products found`
                : `${getDisplayProducts().length} products found`}
          </span>
          <div className="flex gap-2">
            {searchTerm.trim() && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setSearchTerm("");
                  dispatch(clearSearchResults());
                }}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={loading}
              onClick={() => searchInputRef.current?.focus()}
            >
              <Barcode className="w-4 h-4 mr-1" />
              Scan
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        ) : getDisplayProducts().length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No products found matching your search"
                  : "No products available"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid xl:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
            {getDisplayProducts().map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stockQuantity={inventoryMap[product.id] ?? 0}
                trackStock={trackStock}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSection;
