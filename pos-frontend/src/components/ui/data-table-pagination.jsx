import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildPaginationItems,
  getPageRange,
} from "@/utils/paginationUtils";
import { cn } from "@/lib/utils";

/**
 * Reusable server-side pagination bar built on Shadcn/Radix UI primitives.
 */
const DataTablePagination = ({
  page = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  totalElements = 0,
  totalPages = 0,
  currentCount = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  loading = false,
  itemLabel = "items",
  className,
}) => {
  const safeTotalPages = Math.max(0, Number(totalPages) || 0);
  const safePage = safeTotalPages > 0
    ? Math.min(Math.max(0, Number(page) || 0), safeTotalPages - 1)
    : 0;
  const isFirst = safePage <= 0;
  const isLast = safeTotalPages === 0 || safePage >= safeTotalPages - 1;

  const { start, end, total } = getPageRange(
    safePage,
    pageSize,
    totalElements,
    currentCount
  );
  const pageItems = buildPaginationItems(safePage, safeTotalPages);

  const handleGoToPage = (e, targetPage) => {
    e.preventDefault();
    if (loading || targetPage < 0 || targetPage >= safeTotalPages || targetPage === safePage) {
      return;
    }
    onPageChange?.(targetPage);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span>
          {total === 0 ? (
            `0 ${itemLabel}`
          ) : (
            <>
              Showing <strong className="text-foreground">{start}</strong>–
              <strong className="text-foreground">{end}</strong> of{" "}
              <strong className="text-foreground">
                {total.toLocaleString("vi-VN")}
              </strong>{" "}
              {itemLabel}
            </>
          )}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap">Rows / page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={loading}
            >
              <SelectTrigger size="sm" className="w-[74px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {safeTotalPages > 0 && (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => handleGoToPage(e, safePage - 1)}
                aria-disabled={isFirst || loading}
                className={cn(
                  "cursor-pointer select-none",
                  (isFirst || loading) && "pointer-events-none opacity-50"
                )}
              />
            </PaginationItem>

            {pageItems.map((item) =>
              typeof item === "string" ? (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(e) => handleGoToPage(e, item)}
                    aria-disabled={loading}
                    className={cn(
                      "cursor-pointer select-none",
                      loading && "pointer-events-none opacity-60"
                    )}
                  >
                    {item + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => handleGoToPage(e, safePage + 1)}
                aria-disabled={isLast || loading}
                className={cn(
                  "cursor-pointer select-none",
                  (isLast || loading) && "pointer-events-none opacity-50"
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};

export default DataTablePagination;
