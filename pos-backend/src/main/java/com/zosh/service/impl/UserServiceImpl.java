package com.zosh.service.impl;

import com.zosh.configuration.JwtProvider;
import com.zosh.domain.StoreStatus;
import com.zosh.domain.UserRole;
import com.zosh.exceptions.UserException;
import com.zosh.mapper.UserMapper;
import com.zosh.modal.Store;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;
import com.zosh.repository.StoreRepository;
import com.zosh.repository.UserRepository;
import com.zosh.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final JwtProvider jwtProvider;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public User getUserFromJwtToken(String token) throws UserException {
        String email = jwtProvider.getEmailFromToken(token);
        if (email == null) {
            throw new UserException("Invalid token");
        }
        User user = userRepository.findByEmail(email);
        if (user == null) {
            throw new UserException("Invalid token");
        }
        Date issuedAt = jwtProvider.getIssuedAtFromToken(token);
        if (user.getPasswordChangedAt() != null && issuedAt != null) {
            LocalDateTime tokenIssuedTime = LocalDateTime.ofInstant(
                    issuedAt.toInstant(), ZoneId.systemDefault()
            );
            // Cho phép độ lệch 1 giây; nếu token cấp trước khi đổi mật khẩu -> từ chối ngay
            if (tokenIssuedTime.isBefore(user.getPasswordChangedAt().minusSeconds(1))) {
                throw new UserException("Phiên đăng nhập đã hết hiệu lực do mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại.");
            }
        }
        if (Boolean.FALSE.equals(user.getLoginAccess())) {
            throw new UserException("Login access for this account has been disabled by your manager.");
        }
        if (user.getRole() != UserRole.ROLE_ADMIN) {
            Store effectiveStore = resolveEffectiveStore(user);
            if (effectiveStore != null && effectiveStore.getStatus() == StoreStatus.BLOCKED) {
                throw new UserException("Store \"" + effectiveStore.getBrand()
                        + "\" has been BLOCKED by Super Admin. Access is suspended for all accounts in this store.");
            }
        }
        return user;
    }

    @Override
    @Transactional(readOnly = true)
    public User getCurrentUserAllowingBlockedStore() throws UserException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new UserException("user not found");
        }
        String email = authentication.getName();
        User user = userRepository.findByEmail(email);
        if (user == null) {
            throw new UserException("user not found");
        }
        if (Boolean.FALSE.equals(user.getLoginAccess())) {
            throw new UserException("Login access for this account has been disabled by your manager.");
        }
        return user;
    }

    @Override
    @Transactional(readOnly = true)
    public User getCurrentUser() throws UserException {
        User user = getCurrentUserAllowingBlockedStore();
        // JWT có hiệu lực 24h: phải kiểm tra lại trạng thái tài khoản/cửa hàng ở mỗi request
        // để việc khóa tài khoản hoặc BLOCK cửa hàng có hiệu lực ngay lập tức.
        if (user.getRole() != UserRole.ROLE_ADMIN) {
            Store effectiveStore = resolveEffectiveStore(user);
            if (effectiveStore != null && effectiveStore.getStatus() == StoreStatus.BLOCKED) {
                throw new UserException("Store \"" + effectiveStore.getBrand()
                        + "\" has been BLOCKED by Super Admin. Access is suspended for all accounts in this store.");
            }
        }
        return user;
    }

    private UserDto toEnrichedDto(User user) {
        if (user == null) {
            return null;
        }
        return UserMapper.toDTO(user, resolveEffectiveStore(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto getUserProfileDto(String token) throws UserException {
        User user = getUserFromJwtToken(token);
        return toEnrichedDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public User getUserByEmail(String email) throws UserException {
        User user = userRepository.findByEmail(email);
        if (user == null) {
            throw new UserException("user not found");
        }
        return user;
    }

    @Override
    @Transactional(readOnly = true)
    public User getUserById(long id) throws UserException, Exception {
        User target = userRepository.findById(id).orElseThrow(
                () -> new Exception("user not found")
        );
        User currentUser = getCurrentUser();
        if (currentUser.getRole() != UserRole.ROLE_ADMIN && !currentUser.getId().equals(target.getId())) {
            Store myStore = resolveEffectiveStore(currentUser);
            Store targetStore = resolveEffectiveStore(target);
            if (myStore == null || targetStore == null || !myStore.getId().equals(targetStore.getId())) {
                throw new UserException("You do not have permission to view this user");
            }
        }
        return target;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto getUserDtoById(long id) throws UserException, Exception {
        return toEnrichedDto(getUserById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        try {
            User currentUser = getCurrentUser();
            if (currentUser.getRole() == UserRole.ROLE_ADMIN) {
                return userRepository.findAll();
            }
            // Quản lý chi nhánh / Thu ngân: chỉ được xem nhân sự trong đúng chi nhánh của mình
            if ((currentUser.getRole() == UserRole.ROLE_BRANCH_MANAGER
                    || currentUser.getRole() == UserRole.ROLE_BRANCH_CASHIER)
                    && currentUser.getBranch() != null) {
                return userRepository.findByBranchId(currentUser.getBranch().getId());
            }
            Store effectiveStore = resolveEffectiveStore(currentUser);
            if (effectiveStore != null) {
                return userRepository.findByStore(effectiveStore);
            }
            if (currentUser.getBranch() != null) {
                return userRepository.findByBranchId(currentUser.getBranch().getId());
            }
            return Collections.singletonList(currentUser);
        } catch (UserException e) {
            return Collections.emptyList();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> getAllUserDtos() {
        return getAllUsers().stream()
                .map(this::toEnrichedDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserDto> getCashierDtos() {
        return getAllUsers().stream()
                .filter(u -> u.getRole() == UserRole.ROLE_BRANCH_CASHIER)
                .map(this::toEnrichedDto)
                .collect(Collectors.toList());
    }

    private Store resolveEffectiveStore(User user) {
        if (user == null) {
            return null;
        }
        if (user.getStore() != null) {
            return user.getStore();
        }
        if (user.getBranch() != null && user.getBranch().getStore() != null) {
            return user.getBranch().getStore();
        }
        if (user.getId() != null) {
            return storeRepository.findByStoreAdminId(user.getId());
        }
        return null;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public User updateProfile(UserDto userDto) throws UserException {
        User currentUser = getCurrentUser();
        if (userDto.getFullName() != null && !userDto.getFullName().trim().isEmpty()) {
            currentUser.setFullName(userDto.getFullName().trim());
        }
        if (userDto.getPhone() != null) {
            currentUser.setPhone(userDto.getPhone().trim());
        }
        return userRepository.save(currentUser);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserDto updateProfileDto(UserDto userDto) throws UserException {
        return toEnrichedDto(updateProfile(userDto));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void changePassword(String currentPassword, String newPassword) throws UserException {
        User currentUser = getCurrentUser();
        if (currentPassword == null || currentPassword.trim().isEmpty()) {
            throw new UserException("Current password is required");
        }
        if (!passwordEncoder.matches(currentPassword, currentUser.getPassword())) {
            throw new UserException("Current password does not match");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new UserException("New password must be at least 6 characters");
        }
        if (passwordEncoder.matches(newPassword, currentUser.getPassword())) {
            throw new UserException("Mật khẩu mới không được trùng với mật khẩu đang sử dụng.");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();

        // 1. Kiểm tra khoảng cách 5 phút giữa 2 lần đổi mật khẩu
        if (currentUser.getPasswordChangedAt() != null) {
            long secondsSinceLastChange = Duration.between(currentUser.getPasswordChangedAt(), now).getSeconds();
            long requiredSeconds = 5 * 60L;
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

        // 2. Kiểm tra tối đa 3 lần đổi mật khẩu trong 1 ngày
        int countToday = 0;
        if (today.equals(currentUser.getPasswordChangeCountDate()) && currentUser.getDailyPasswordChangeCount() != null) {
            countToday = currentUser.getDailyPasswordChangeCount();
        }
        if (countToday >= 3) {
            throw new UserException("Bạn đã đạt giới hạn đổi mật khẩu tối đa 3 lần trong ngày hôm nay. Vui lòng thử lại vào ngày mai.");
        }

        currentUser.setPassword(passwordEncoder.encode(newPassword));
        currentUser.setDailyPasswordChangeCount(countToday + 1);
        currentUser.setPasswordChangeCountDate(today);
        currentUser.setPasswordChangedAt(now);
        userRepository.save(currentUser);
    }
}
