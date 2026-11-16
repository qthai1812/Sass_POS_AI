import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Barcode, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ProductCard from "./ProductCard";
import { useDispatch, useSelector } from "react-redux";
import { getProductsByStorePaged } from "../../../Redux Toolkit/features/product/productThunks";
import { getBranchById } from "../../../Redux Toolkit/features/branch/branchThunks";
import { getInventoryByBranch } from "../../../Redux Toolkit/features/inventory/inventoryThunks";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import { normalizePageResponse } from "@/utils/paginationUtils";

const POS_LAZY_PAGE_SIZE = 12;

const ProductSection = ({ searchInputRef }) => {
  const dispatch = useDispatch();
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const { inventories = [] } = useSelector((state) => state.inventory || {});

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [posProducts, setPosProducts] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { toast } = useToast();
  const { hasFeature } = usePlanEntitlements();
  const trackStock = hasFeature("inventory");

  const scrollContainerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const debouncedSearchRef = useRef("");
  const requestSeqRef = useRef(0);

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

  const activeBranchId = branch?.id || userProfile?.branchId;
  const activeStoreId = branch?.storeId || userProfile?.storeId;

  // Đảm bảo đã tải thông tin chi nhánh nếu Redux branch chưa sẵn sàng
  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!branch && userProfile?.branchId && jwt) {
      dispatch(
        getBranchById({
          id: userProfile.branchId,
          jwt,
        }),
      )
        .unwrap()
        .catch(() => {
          toast({
            title: "Error",
            description: "Failed to load branch information",
            variant: "destructive",
          });
        });
    }
  }, [dispatch, branch, userProfile?.branchId, toast]);

  // Tải tồn kho chi nhánh hiện tại (đồng bộ với CartSection và usePosPaymentFlow)
  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (activeBranchId && jwt) {
      dispatch(getInventoryByBranch(activeBranchId))
        .unwrap()
        .catch((error) => {
          toast({
            title: "Error",
            description: error || "Failed to fetch branch stock",
            variant: "destructive",
          });
        });
    }
  }, [dispatch, activeBranchId, toast]);

  // Reset trạng thái lazy load khi đổi cửa hàng
  useEffect(() => {
    setPage(0);
    setPosProducts([]);
    setTotalElements(0);
    setHasMore(false);
  }, [activeStoreId]);

  // Lazy load từng batch sản phẩm từ API phân trang phía máy chủ
  useEffect(() => {
    const jwt = localStorage.getItem("jwt");
    if (!activeStoreId || !jwt) return;

    const seq = ++requestSeqRef.current;
    const isFirstPage = page === 0;
    if (isFirstPage) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }

    dispatch(
      getProductsByStorePaged({
        storeId: activeStoreId,
        keyword: debouncedSearch,
        page,
        size: POS_LAZY_PAGE_SIZE,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
    )
      .unwrap()
      .then((res) => {
        if (requestSeqRef.current !== seq) return;
        const normalized = normalizePageResponse(res);
        setPosProducts((prev) => {
          if (isFirstPage) return normalized.content;
          const seenIds = new Set(prev.map((item) => item?.id));
          const uniqueNext = normalized.content.filter(
            (item) => item && !seenIds.has(item.id),
          );
          return [...prev, ...uniqueNext];
        });
        setTotalElements(normalized.totalElements);
        setHasMore(
          !normalized.last &&
            normalized.pageNumber + 1 < normalized.totalPages,
        );
      })
      .catch((error) => {
        if (requestSeqRef.current !== seq) return;
        toast({
          title: "Error",
          description:
            (typeof error === "string" ? error : error?.message) ||
            "Failed to fetch products",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (requestSeqRef.current !== seq) return;
        setLoadingInitial(false);
        setLoadingMore(false);
      });
  }, [dispatch, activeStoreId, debouncedSearch, page, toast]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loadingInitial && !loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [loadingInitial, loadingMore, hasMore]);

  // Tự động nạp thêm khi người dùng cuộn tới gần cuối vùng hiển thị
  useEffect(() => {
    const rootEl = scrollContainerRef.current;
    const targetEl = loadMoreTriggerRef.current;
    if (!rootEl || !targetEl || !hasMore) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        root: rootEl,
        rootMargin: "120px",
        threshold: 0.1,
      },
    );

    observer.observe(targetEl);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore, posProducts.length]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      const next = val.trim();
      if (debouncedSearchRef.current !== next) {
        debouncedSearchRef.current = next;
        setDebouncedSearch(next);
        setPage(0);
      }
    }, 350);
  };

  const handleClearSearch = () => {
    clearTimeout(debounceTimeoutRef.current);
    setSearchTerm("");
    if (debouncedSearchRef.current !== "") {
      debouncedSearchRef.current = "";
      setDebouncedSearch("");
      setPage(0);
    }
  };

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
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-muted-foreground">
            {loadingInitial
              ? "Loading products..."
              : debouncedSearch
                ? `Search results: ${posProducts.length} / ${totalElements} products found`
                : `Showing ${posProducts.length} of ${totalElements} products`}
          </span>
          <div className="flex gap-2">
            {searchTerm.trim() && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleClearSearch}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Barcode className="w-4 h-4 mr-1" />
              Scan
            </Button>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {loadingInitial ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        ) : posProducts.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {debouncedSearch
                  ? "No products found matching your search"
                  : "No products available"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid xl:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
              {posProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  stockQuantity={inventoryMap[product.id] ?? 0}
                  trackStock={trackStock}
                />
              ))}
            </div>

            <div
              ref={loadMoreTriggerRef}
              className="mt-4 py-3 flex flex-col items-center justify-center gap-2"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tải thêm sản phẩm...</span>
                </div>
              ) : hasMore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  className="text-xs"
                >
                  Tải thêm sản phẩm ({posProducts.length}/{totalElements})
                </Button>
              ) : posProducts.length > 0 && totalElements > POS_LAZY_PAGE_SIZE ? (
                <span className="text-xs text-muted-foreground">
                  Đã hiển thị tất cả {totalElements} sản phẩm
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductSection;
