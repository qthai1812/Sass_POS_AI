package com.zosh.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.Collections;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Standard pagination response wrapper shared across paged endpoints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> content;
    private int pageNumber;
    private int pageSize;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    /**
     * Builds a PageResponse from a Spring Data Page and a mapper function.
     */
    public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        List<T> mapped = page.getContent().stream()
                .map(mapper)
                .collect(Collectors.toList());
        return of(page, mapped);
    }

    /**
     * Builds a PageResponse from page metadata and pre-mapped content (e.g., two-step query).
     */
    public static <T> PageResponse<T> of(Page<?> pageMeta, List<T> content) {
        return PageResponse.<T>builder()
                .content(content != null ? content : Collections.emptyList())
                .pageNumber(pageMeta.getNumber())
                .pageSize(pageMeta.getSize())
                .totalElements(pageMeta.getTotalElements())
                .totalPages(pageMeta.getTotalPages())
                .first(pageMeta.isFirst())
                .last(pageMeta.isLast())
                .build();
    }

    /**
     * Returns an empty PageResponse with normalized page metadata.
     */
    public static <T> PageResponse<T> empty(int pageNumber, int pageSize) {
        return PageResponse.<T>builder()
                .content(Collections.emptyList())
                .pageNumber(Math.max(0, pageNumber))
                .pageSize(Math.max(1, pageSize))
                .totalElements(0L)
                .totalPages(0)
                .first(true)
                .last(true)
                .build();
    }
}
