package com.zosh.util;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Normalizes pagination and sorting inputs to prevent unbounded queries and invalid sort fields.
 */
public final class PaginationUtils {

    public static final int DEFAULT_PAGE = 0;
    public static final int DEFAULT_PAGE_SIZE = 10;
    public static final int MAX_PAGE_SIZE = 100;

    private PaginationUtils() {
    }

    public static int normalizePage(int page) {
        return Math.max(0, page);
    }

    public static int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    public static Pageable buildPageable(
            int page,
            int size,
            String sortBy,
            String sortDir,
            Set<String> allowedSortFields,
            String defaultSortField
    ) {
        int safePage = normalizePage(page);
        int safeSize = normalizeSize(size);
        String resolvedSortField = (sortBy != null && allowedSortFields.contains(sortBy))
                ? sortBy
                : defaultSortField;

        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        // Secondary sort by id ensures deterministic ordering across pages when primary values match.
        Sort sort = "id".equals(resolvedSortField)
                ? Sort.by(direction, "id")
                : Sort.by(direction, resolvedSortField).and(Sort.by(direction, "id"));

        return PageRequest.of(safePage, safeSize, sort);
    }
}
