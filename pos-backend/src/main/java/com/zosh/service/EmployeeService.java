package com.zosh.service;

import com.zosh.domain.UserRole;
import com.zosh.modal.User;
import com.zosh.payload.dto.UserDto;

import java.util.List;

public interface EmployeeService {

    UserDto createStoreEmployee(UserDto employee, Long storeId) throws Exception;

    UserDto createBranchEmployee(UserDto employee, Long branchId) throws Exception;

    User updateEmployee(Long employeeId, UserDto employeeDetails) throws Exception;

    UserDto updateEmployeeDto(Long employeeId, UserDto employeeDetails) throws Exception;

    void deleteEmployee(Long employeeId) throws Exception;

    UserDto findEmployeeById(Long employeeId) throws Exception;

    List<UserDto> findStoreEmployees(Long storeId, UserRole role) throws Exception;

    List<UserDto> findBranchEmployees(Long branchId, UserRole role) throws Exception;
}