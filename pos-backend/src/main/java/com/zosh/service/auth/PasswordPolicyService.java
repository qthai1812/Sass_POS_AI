package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import com.zosh.modal.User;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Quy tắc đổi/đặt lại mật khẩu dùng chung cho cả AuthServiceImpl và UserServiceImpl:
 * - Tối thiểu 6 ký tự
 * - Giãn cách 5 phút giữa 2 lần đổi mật khẩu
 * - Tối đa 3 lần đổi mật khẩu trong một ngày
 */
@Component
public class PasswordPolicyService {

    public static final int MIN_PASSWORD_LENGTH = 6;
    public static final int PASSWORD_CHANGE_COOLDOWN_MINUTES = 5;
    public static final int MAX_DAILY_PASSWORD_CHANGES = 3;

    public void enforceChangeLimits(User user) throws UserException {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();

        if (user.getPasswordChangedAt() != null) {
            long secondsSinceLastChange = Duration.between(user.getPasswordChangedAt(), now).getSeconds();
            long requiredSeconds = PASSWORD_CHANGE_COOLDOWN_MINUTES * 60L;
            if (secondsSinceLastChange < requiredSeconds) {
                long remainingSeconds = requiredSeconds - secondsSinceLastChange;
                long mins = remainingSeconds / 60;
                long secs = remainingSeconds % 60;
                throw new UserException(String.format(
                        "Bạn vừa đổi mật khẩu gần đây. Vui lòng đợi %d phút %d giây nữa mới được đổi mật khẩu tiếp (tối thiểu 5 phút/lần).",
                        mins, secs
                ));
            }
        }

        int countToday = getTodayChangeCount(user, today);
        if (countToday >= MAX_DAILY_PASSWORD_CHANGES) {
            throw new UserException("Bạn đã đạt giới hạn đổi mật khẩu tối đa 3 lần trong ngày hôm nay. Vui lòng thử lại vào ngày mai.");
        }
    }

    public void applyPasswordUpdate(User user, String encodedNewPassword) {
        LocalDateTime now = LocalDateTime.now().withNano(0);
        LocalDate today = LocalDate.now();

        user.setPassword(encodedNewPassword);
        user.setDailyPasswordChangeCount(getTodayChangeCount(user, today) + 1);
        user.setPasswordChangeCountDate(today);
        user.setPasswordChangedAt(now);
    }

    private int getTodayChangeCount(User user, LocalDate today) {
        if (today.equals(user.getPasswordChangeCountDate()) && user.getDailyPasswordChangeCount() != null) {
            return user.getDailyPasswordChangeCount();
        }
        return 0;
    }
}
