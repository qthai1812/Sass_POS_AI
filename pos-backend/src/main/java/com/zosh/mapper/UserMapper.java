package com.zosh.mapper;

import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;

public class UserMapper {

    public static UserDto toDTO(User savedUser) {
        return toDTO(savedUser, null);
    }

    public static UserDto toDTO(User savedUser, com.zosh.modal.Store fallbackStore) {
        if (savedUser == null) {
            return null;
        }
        UserDto userDto = new UserDto();
        userDto.setId(savedUser.getId());
        userDto.setFullName(savedUser.getFullName());
        userDto.setEmail(savedUser.getEmail());
        userDto.setRole(savedUser.getRole());
        userDto.setCreatedAt(savedUser.getCreatedAt());
        userDto.setUpdatedAt(savedUser.getUpdatedAt());
        userDto.setLastLogin(savedUser.getLastLogin());
        userDto.setPhone(savedUser.getPhone());
        com.zosh.modal.Store effectiveStore = savedUser.getStore();
        if (effectiveStore == null && savedUser.getBranch() != null) {
            effectiveStore = savedUser.getBranch().getStore();
        }
        if (effectiveStore == null) {
            effectiveStore = fallbackStore;
        }
        userDto.setStoreId(effectiveStore != null ? effectiveStore.getId() : null);
        userDto.setStoreName(effectiveStore != null ? effectiveStore.getBrand() : null);
        userDto.setStoreStatus(
                effectiveStore != null && effectiveStore.getStatus() != null
                        ? effectiveStore.getStatus().name()
                        : null
        );
        userDto.setBranchId(savedUser.getBranch() != null ? savedUser.getBranch().getId() : null);
        userDto.setBranchName(savedUser.getBranch() != null ? savedUser.getBranch().getName() : null);
        userDto.setLoginAccess(savedUser.getLoginAccess() != null ? savedUser.getLoginAccess() : true);

        return userDto;
    }

    public static User toEntity(UserDto userDto) {
        User createdUser = new User();
        createdUser.setEmail(userDto.getEmail());
        createdUser.setFullName(userDto.getFullName());
        createdUser.setRole(userDto.getRole());
        createdUser.setCreatedAt(userDto.getCreatedAt());
        createdUser.setUpdatedAt(userDto.getUpdatedAt());
        createdUser.setLastLogin(userDto.getLastLogin());
        createdUser.setPhone(userDto.getPhone());
        createdUser.setPassword(userDto.getPassword());
        createdUser.setLoginAccess(userDto.getLoginAccess() != null ? userDto.getLoginAccess() : true);

        return createdUser;
    }
}
