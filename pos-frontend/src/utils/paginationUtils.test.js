import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPaginationItems,
  getPageRange,
  normalizePageResponse,
} from "./paginationUtils.js";

describe("paginationUtils", () => {
  it("builds full page list when totalPages <= 7", () => {
    assert.deepEqual(buildPaginationItems(0, 0), []);
    assert.deepEqual(buildPaginationItems(0, 5), [0, 1, 2, 3, 4]);
    assert.deepEqual(buildPaginationItems(6, 7), [0, 1, 2, 3, 4, 5, 6]);
  });

  it("collapses distant pages with ellipsis when totalPages > 7", () => {
    assert.deepEqual(buildPaginationItems(0, 12), [
      0,
      1,
      "ellipsis-right",
      11,
    ]);
    assert.deepEqual(buildPaginationItems(5, 12), [
      0,
      "ellipsis-left",
      4,
      5,
      6,
      "ellipsis-right",
      11,
    ]);
    assert.deepEqual(buildPaginationItems(11, 12), [
      0,
      "ellipsis-left",
      10,
      11,
    ]);
  });

  it("computes accurate 1-based display range", () => {
    assert.deepEqual(getPageRange(0, 10, 0, 0), { start: 0, end: 0, total: 0 });
    assert.deepEqual(getPageRange(0, 10, 45, 10), { start: 1, end: 10, total: 45 });
    assert.deepEqual(getPageRange(4, 10, 45, 5), { start: 41, end: 45, total: 45 });
  });

  it("normalizes backend PageResponse payload safely", () => {
    const empty = normalizePageResponse(null);
    assert.deepEqual(empty, {
      content: [],
      pageNumber: 0,
      pageSize: 10,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    });

    const page = normalizePageResponse({
      content: [{ id: 1 }, { id: 2 }],
      pageNumber: 1,
      pageSize: 20,
      totalElements: 42,
      totalPages: 3,
      first: false,
      last: false,
    });
    assert.equal(page.content.length, 2);
    assert.equal(page.pageNumber, 1);
    assert.equal(page.totalPages, 3);
    assert.equal(page.last, false);
  });
});
