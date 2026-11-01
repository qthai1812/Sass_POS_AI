import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

const InventoryFilters = ({
  searchTerm = "",
  onSearch,
  setSearchTerm,
  category = "all",
  selectedCategory,
  onCategoryChange,
  setCategory,
  setSelectedCategory,
  categories = [],
  categoryList = [],
  products = [],
  inventoryRows = [],
  inventories = [],
  filteredInventories = [],
}) => {
  // Đảm bảo luôn là mảng hợp lệ để không bao giờ bị lỗi .map() of undefined
  const rawCategories =
    (Array.isArray(categories) && categories.length > 0 && categories) ||
    (Array.isArray(categoryList) && categoryList.length > 0 && categoryList) ||
    [];

  // Nếu danh sách categories từ Redux chưa kịp tải, tự động trích xuất danh mục từ danh sách sản phẩm/tồn kho
  const safeRows =
    (Array.isArray(inventoryRows) &&
      inventoryRows.length > 0 &&
      inventoryRows) ||
    (Array.isArray(filteredInventories) &&
      filteredInventories.length > 0 &&
      filteredInventories) ||
    (Array.isArray(inventories) && inventories) ||
    [];

  const derivedCategoryNames = Array.from(
    new Set(
      [
        ...rawCategories.map((c) => (typeof c === "object" ? c?.name : c)),
        ...(Array.isArray(products)
          ? products.map((p) =>
              typeof p?.category === "object" ? p.category?.name : p?.category,
            )
          : []),
        ...safeRows.map((r) =>
          typeof r?.category === "object"
            ? r.category?.name
            : r?.category || r?.product?.category?.name,
        ),
      ].filter((name) => name && name !== "Chưa phân loại"),
    ),
  );

  const currentCategory = selectedCategory ?? category ?? "all";

  const handleSearchInput = (e) => {
    if (typeof onSearch === "function") {
      onSearch(e);
    } else if (typeof setSearchTerm === "function") {
      setSearchTerm(e.target.value);
    }
  };

  const handleSelectCategory = (val) => {
    if (typeof onCategoryChange === "function") {
      onCategoryChange(val);
    } else if (typeof setCategory === "function") {
      setCategory(val);
    } else if (typeof setSelectedCategory === "function") {
      setSelectedCategory(val);
    }
  };

  const totalQuantity = safeRows.reduce(
    (sum, item) => sum + Number(item?.quantity ?? 0),
    0,
  );

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Ô tìm kiếm */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={handleSearchInput}
              className="pl-9 w-full"
            />
          </div>

          {/* Bộ lọc Danh mục */}
          <div className="w-full">
            <Select
              value={currentCategory}
              onValueChange={handleSelectCategory}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {derivedCategoryNames.map((catName) => (
                  <SelectItem key={catName} value={catName}>
                    {catName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tổng số lượng tồn kho */}
          <div className="flex items-center justify-between md:justify-start gap-2 px-4 py-2 rounded-lg border bg-muted/30">
            <span className="text-sm sm:text-base font-medium text-muted-foreground">
              Total Quantity :
            </span>
            <span className="text-lg sm:text-xl font-bold text-emerald-500">
              {totalQuantity.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventoryFilters;
