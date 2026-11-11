package com.zosh.service.ai;

import java.text.NumberFormat;
import java.util.Locale;

/**
 * Tiện ích định dạng tiền tệ VND cho báo cáo AI Copilot.
 */
public final class AiFormatUtils {

    private AiFormatUtils() {
    }

    public static String formatVnd(Double amount) {
        double safe = amount != null ? amount : 0.0;
        return NumberFormat.getInstance(new Locale("vi", "VN")).format(Math.round(safe)) + " đ";
    }
}
