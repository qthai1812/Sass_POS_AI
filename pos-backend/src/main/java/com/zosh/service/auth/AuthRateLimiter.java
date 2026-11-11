package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Chống brute-force & hành vi bất thường theo từng key (IP hoặc Email).
 * Khóa tạm thời 15 phút nếu vượt quá 10 yêu cầu hoặc >= 5 lần thất bại trong cửa sổ 15 phút.
 */
@Component
public class AuthRateLimiter {

    static final int MAX_REQUESTS_PER_WINDOW = 10;
    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int WINDOW_MINUTES = 15;
    static final int BLOCK_MINUTES = 15;
    private static final int CLEANUP_THRESHOLD = 2000;

    private static class SuspiciousActivityTracker {
        int requestCount = 0;
        int failedAttempts = 0;
        LocalDateTime windowStart = LocalDateTime.now();
        LocalDateTime blockedUntil = null;
    }

    private final Map<String, SuspiciousActivityTracker> securityTrackers = new ConcurrentHashMap<>();

    public void checkAndRecord(String key, boolean isFailure) throws UserException {
        if (key == null || key.isBlank()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        cleanupStaleTrackersIfNeeded(now);

        SuspiciousActivityTracker tracker = securityTrackers.computeIfAbsent(key, k -> new SuspiciousActivityTracker());
        synchronized (tracker) {
            if (tracker.blockedUntil != null && now.isBefore(tracker.blockedUntil)) {
                long waitSeconds = Duration.between(now, tracker.blockedUntil).getSeconds();
                throw new UserException("Phát hiện hành vi đáng ngờ hoặc quá nhiều yêu cầu liên tiếp. Vui lòng thử lại sau "
                        + Math.max(1, (waitSeconds + 59) / 60) + " phút.");
            }
            if (Duration.between(tracker.windowStart, now).toMinutes() >= WINDOW_MINUTES) {
                tracker.windowStart = now;
                tracker.requestCount = 0;
                tracker.failedAttempts = 0;
                tracker.blockedUntil = null;
            }
            tracker.requestCount++;
            if (isFailure) {
                tracker.failedAttempts++;
            }
            if (tracker.requestCount > MAX_REQUESTS_PER_WINDOW || tracker.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                tracker.blockedUntil = now.plusMinutes(BLOCK_MINUTES);
                throw new UserException("Tài khoản/IP của bạn tạm thời bị chặn 15 phút do có quá nhiều thao tác bất thường.");
            }
        }
    }

    private void cleanupStaleTrackersIfNeeded(LocalDateTime now) {
        if (securityTrackers.size() <= CLEANUP_THRESHOLD) {
            return;
        }
        securityTrackers.entrySet().removeIf(entry -> {
            SuspiciousActivityTracker t = entry.getValue();
            if (t == null) {
                return true;
            }
            boolean blockExpired = t.blockedUntil == null || now.isAfter(t.blockedUntil);
            return blockExpired && Duration.between(t.windowStart, now).toMinutes() >= 30;
        });
    }
}
