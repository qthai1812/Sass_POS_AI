import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const ProductSearch = ({
  searchQuery: controlledQuery,
  onSearchChange,
  onSearch,
  isSearching = false,
}) => {
  const [internalQuery, setInternalQuery] = useState("");
  const isControlled = controlledQuery !== undefined;
  const searchQuery = isControlled ? controlledQuery : internalQuery;

  const updateQuery = (next) => {
    if (!isControlled) {
      setInternalQuery(next);
    }
    onSearchChange?.(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch?.(searchQuery.trim() || null);
  };

  const clearSearch = () => {
    updateQuery("");
    onSearch?.(null);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex w-full max-w-sm items-center space-x-2"
    >
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search products by name, brand, or SKU..."
          value={searchQuery}
          onChange={(e) => updateQuery(e.target.value)}
          className="pl-9 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSearching}
        className="bg-emerald-600 hover:bg-emerald-700"
      >
        {isSearching ? "Searching..." : "Search"}
      </Button>
    </form>
  );
};

export default ProductSearch;
