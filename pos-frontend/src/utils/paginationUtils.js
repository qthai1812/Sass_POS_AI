export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Returns a sequence of 0-based page numbers and "ellipsis" markers
 * so long page ranges collapse cleanly.
 */
export function buildPaginationItems(currentPage, totalPages) {
  const safeTotal = Math.max(0, Number(totalPages) || 0);
  if (safeTotal === 0) {
    return [];
  }

  const safeCurrent = Math.min(
    Math.max(0, Number(currentPage) || 0),
    safeTotal - 1
  );

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, i) => i);
  }

  const items = [0];
  const windowStart = Math.max(1, safeCurrent - 1);
  const windowEnd = Math.min(safeTotal - 2, safeCurrent + 1);

  if (windowStart > 1) {
    items.push("ellipsis-left");
  }
  for (let p = windowStart; p <= windowEnd; p++) {
    items.push(p);
  }
  if (windowEnd < safeTotal - 2) {
    items.push("ellipsis-right");
  }
  items.push(safeTotal - 1);

  return items;
}

/**
 * Computes 1-based start/end indices for display ("Showing X-Y of Z").
 */
export function getPageRange(pageNumber, pageSize, totalElements, currentCount) {
  const total = Math.max(0, Number(totalElements) || 0);
  const safePage = Math.max(0, Number(pageNumber) || 0);
  const safeSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const count = Math.max(0, Number(currentCount) || 0);

  if (total === 0 || count === 0) {
    return { start: 0, end: 0, total };
  }

  const start = safePage * safeSize + 1;
  const end = Math.min(start + count - 1, total);
  return { start, end, total };
}

/**
 * Normalizes backend PageResponse payloads with safe fallbacks.
 */
export function normalizePageResponse(payload, fallbackSize = DEFAULT_PAGE_SIZE) {
  const content = Array.isArray(payload?.content) ? payload.content : [];
  const pageNumber = Math.max(0, Number(payload?.pageNumber) || 0);
  const pageSize = Math.max(1, Number(payload?.pageSize) || fallbackSize);
  const totalElements = Math.max(0, Number(payload?.totalElements) || 0);
  const totalPages = Math.max(0, Number(payload?.totalPages) || 0);

  return {
    content,
    pageNumber,
    pageSize,
    totalElements,
    totalPages,
    first: payload?.first ?? pageNumber === 0,
    last: payload?.last ?? (totalPages === 0 || pageNumber >= totalPages - 1),
  };
}
