package com.zosh.service.ai;

import com.zosh.mapper.ProductMapper;
import com.zosh.modal.Customer;
import com.zosh.modal.Product;
import com.zosh.payload.dto.CouponDTO;
import com.zosh.payload.response.AiCopilotDTOs.QuickCommandItemResult;
import com.zosh.payload.response.AiCopilotDTOs.QuickCommandResponse;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ phân tích câu lệnh lên đơn nhanh bằng ngôn ngữ tự nhiên / giọng nói tiếng Việt tại quầy POS:
 * bóc tách mã giảm giá, khách hàng (SĐT/tên), số lượng tiếng Việt, phương thức thanh toán và sản phẩm khớp nhất.
 */
@Component
@RequiredArgsConstructor
public class PosVoiceCommandParser {

    private static final Pattern COUPON_PATTERN =
            Pattern.compile("(?iU)(?:áp\\s*mã|mã\\s*giảm\\s*giá|coupon|voucher)\\s+([A-Za-z0-9_-]{3,20})");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(0\\d{8,10})");
    private static final Pattern CUSTOMER_NAME_PATTERN =
            Pattern.compile("(?iU)(?:khách\\s+hàng|khách\\s+tên)\\s+([\\p{L}\\s]{2,25}?)(?=,|;|\\.|\\d|áp\\s*mã|thanh\\s*toán|$)");
    private static final Pattern ITEM_PATTERN =
            Pattern.compile("(?iU)(?:lấy|mua|thêm|cho|đặt)?\\s*(\\d{1,4})\\s*(?:cái|chiếc|hộp|chai|lon|ly|cốc|gói|bộ|đôi|sp|sản\\s+phẩm|món)?\\s+([^,;+\\n]+)");

    private static final String QTY_PREFIX = "(?iU)(?<=^|[,;+\\n]|\\b(?:lấy|mua|thêm|cho|đặt)\\s+)";
    private static final String QTY_SUFFIX = "(?=\\s+(?:cái|chiếc|hộp|chai|lon|ly|cốc|gói|bộ|đôi|sp|sản\\s+phẩm|món|áo|quần|váy|đầm|giày|dép|túi|nón|mũ)\\b)";
    private static final String[][] VN_NUMBERS = {
            {"mười", "10"}, {"một", "1"}, {"hai", "2"}, {"ba", "3"}, {"bốn", "4"},
            {"năm", "5"}, {"sáu", "6"}, {"bảy", "7"}, {"tám", "8"}, {"chín", "9"}
    };

    private final CouponService couponService;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;

    private record CouponExtraction(CouponDTO coupon, String error, String remainingText) {
    }

    private record CustomerExtraction(Customer customer, String remainingText) {
    }

    public QuickCommandResponse parse(Long storeId, String rawCommand) {
        String rawText = rawCommand.trim();

        CouponExtraction couponExt = extractCoupon(rawText, storeId);
        // Bóc tách khách hàng TRƯỚC khi đổi chữ số tiếng Việt sang số để tránh hỏng tên khách (VD: "Trần Văn Năm")
        CustomerExtraction custExt = extractCustomer(couponExt.remainingText(), storeId);
        String workingText = normalizeVietnameseQuantities(custExt.remainingText());
        String paymentMethod = detectPaymentMethod(rawText);

        List<Product> storeProducts = productRepository.findByStoreId(storeId);
        List<QuickCommandItemResult> matchedItems = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();
        parseLineItems(workingText, storeProducts, matchedItems, unmatched);

        String summary = buildSummaryMessage(matchedItems.size(), custExt.customer(), couponExt.coupon(), couponExt.error());

        return QuickCommandResponse.builder()
                .matchedItems(matchedItems)
                .unmatchedKeywords(unmatched)
                .matchedCustomer(custExt.customer())
                .appliedCoupon(couponExt.coupon())
                .couponError(couponExt.error())
                .paymentMethod(paymentMethod)
                .note("AI Quick Order: " + rawText)
                .summaryMessage(summary)
                .build();
    }

    private CouponExtraction extractCoupon(String workingText, Long storeId) {
        Matcher couponMatcher = COUPON_PATTERN.matcher(workingText);
        if (!couponMatcher.find()) {
            return new CouponExtraction(null, null, workingText);
        }
        String code = couponMatcher.group(1).trim().toUpperCase();
        String remaining = workingText.replace(couponMatcher.group(0), " ");
        try {
            CouponDTO matched = couponService.getCouponByCode(code, storeId);
            return new CouponExtraction(matched, null, remaining);
        } catch (Exception e) {
            return new CouponExtraction(null, "Mã '" + code + "': " + e.getMessage(), remaining);
        }
    }

    private CustomerExtraction extractCustomer(String workingText, Long storeId) {
        Customer matchedCustomer = null;
        String text = workingText;

        Matcher phoneMatcher = PHONE_PATTERN.matcher(text);
        if (phoneMatcher.find()) {
            String phone = phoneMatcher.group(1);
            text = text.replace(phone, " ");
            List<Customer> found = customerRepository.searchCustomersByStore(storeId, phone);
            if (!found.isEmpty()) {
                matchedCustomer = found.get(0);
            }
        }
        if (matchedCustomer == null) {
            Matcher nameMatcher = CUSTOMER_NAME_PATTERN.matcher(text);
            if (nameMatcher.find()) {
                String cName = nameMatcher.group(1).trim();
                text = text.replace(nameMatcher.group(0), " ");
                List<Customer> found = customerRepository.searchCustomersByStore(storeId, cName);
                if (!found.isEmpty()) {
                    matchedCustomer = found.get(0);
                }
            }
        }
        return new CustomerExtraction(matchedCustomer, text);
    }

    private String normalizeVietnameseQuantities(String text) {
        String working = text;
        for (String[] pair : VN_NUMBERS) {
            working = working.replaceAll(QTY_PREFIX + "\\b" + pair[0] + "\\b", pair[1]);
            working = working.replaceAll("(?iU)\\b" + pair[0] + "\\b" + QTY_SUFFIX, pair[1]);
        }
        return working;
    }

    String detectPaymentMethod(String rawText) {
        String lowerRaw = rawText.toLowerCase();
        if (lowerRaw.contains("momo") || lowerRaw.contains("quét mã")
                || lowerRaw.contains("qr") || lowerRaw.contains("chuyển khoản")) {
            return "UPI";
        }
        if (lowerRaw.contains("thẻ") || lowerRaw.contains("visa")
                || lowerRaw.contains("card") || lowerRaw.contains("quẹt thẻ")) {
            return "CARD";
        }
        if (lowerRaw.contains("tiền mặt") || lowerRaw.contains("cash")) {
            return "CASH";
        }
        return null;
    }

    private void parseLineItems(
            String workingText,
            List<Product> storeProducts,
            List<QuickCommandItemResult> matchedItems,
            List<String> unmatched
    ) {
        String sanitized = workingText
                .replaceAll("(?iU)\\b(?:cho\\s+khách|sđt|số\\s+điện\\s+thoại)\\b", " ")
                .replaceAll("(?iU)thanh\\s+toán\\s*(?:bằng|qua)?\\s*(?:tiền\\s+mặt|thẻ|visa|card|momo|qr|chuyển\\s+khoản)?", " ");

        Matcher itemMatcher = ITEM_PATTERN.matcher(sanitized);
        Map<Long, QuickCommandItemResult> mergedByProductId = new LinkedHashMap<>();
        boolean foundPatternMatch = false;

        while (itemMatcher.find()) {
            foundPatternMatch = true;
            int parsedQty = 1;
            try {
                parsedQty = Math.min(9999, Math.max(1, Integer.parseInt(itemMatcher.group(1))));
            } catch (NumberFormatException ignored) {
            }
            final int qty = parsedQty;
            String rawKeyword = itemMatcher.group(2)
                    .replaceAll("(?iU)\\b(cho|khách|áp|mã|sđt)\\b.*$", "")
                    .trim();
            if (rawKeyword.isEmpty()) {
                continue;
            }

            Product bestMatch = findBestMatchingProduct(storeProducts, rawKeyword);
            if (bestMatch != null) {
                mergedByProductId.compute(bestMatch.getId(), (k, existing) -> {
                    if (existing == null) {
                        return QuickCommandItemResult.builder()
                                .product(ProductMapper.toDTO(bestMatch))
                                .quantity(qty)
                                .rawKeyword(rawKeyword)
                                .build();
                    }
                    existing.setQuantity(existing.getQuantity() + qty);
                    return existing;
                });
            } else {
                unmatched.add(rawKeyword);
            }
        }

        if (!foundPatternMatch) {
            for (String segment : sanitized.split("[,;+]")) {
                String clean = segment.replaceAll("(?i)^(lấy|mua|thêm)\\s+", "").trim();
                if (clean.length() < 2) {
                    continue;
                }
                Product best = findBestMatchingProduct(storeProducts, clean);
                if (best != null) {
                    mergedByProductId.putIfAbsent(best.getId(), QuickCommandItemResult.builder()
                            .product(ProductMapper.toDTO(best))
                            .quantity(1)
                            .rawKeyword(clean)
                            .build());
                } else {
                    unmatched.add(clean);
                }
            }
        }

        matchedItems.addAll(mergedByProductId.values());
    }

    public Product findBestMatchingProduct(List<Product> products, String keyword) {
        if (products == null || keyword == null || keyword.isBlank()) {
            return null;
        }
        String normKey = keyword.toLowerCase().trim();
        Product best = null;
        int bestScore = 0;

        for (Product p : products) {
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            String sku = p.getSku() != null ? p.getSku().toLowerCase() : "";
            int score = 0;
            if (name.equals(normKey) || sku.equals(normKey)) {
                score = 100;
            } else if (name.contains(normKey) || sku.contains(normKey)) {
                score = 80;
            } else if (normKey.contains(name) && name.length() >= 3) {
                score = 70;
            } else {
                String[] words = normKey.split("\\s+");
                int matchedWords = 0;
                for (String w : words) {
                    if (w.length() >= 2 && (name.contains(w) || sku.contains(w))) {
                        matchedWords++;
                    }
                }
                if (matchedWords > 0) {
                    score = (matchedWords * 50) / words.length;
                }
            }
            if (score > bestScore && score >= 40) {
                bestScore = score;
                best = p;
            }
        }
        return best;
    }

    private String buildSummaryMessage(
            int matchedCount,
            Customer matchedCustomer,
            CouponDTO matchedCoupon,
            String couponError
    ) {
        StringBuilder summary = new StringBuilder();
        summary.append("Đã nhận diện ").append(matchedCount).append(" sản phẩm");
        if (matchedCustomer != null) {
            summary.append(", khách hàng: ").append(matchedCustomer.getFullName());
        }
        if (matchedCoupon != null) {
            summary.append(", áp mã: ").append(matchedCoupon.getCode());
        }
        if (couponError != null) {
            summary.append(" (").append(couponError).append(")");
        }
        return summary.toString();
    }
}
