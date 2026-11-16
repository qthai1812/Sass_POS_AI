package com.zosh.service;

import com.zosh.modal.Customer;
import com.zosh.payload.dto.CustomerDTO;
import com.zosh.payload.dto.CustomerSummaryDTO;
import com.zosh.payload.response.PageResponse;

import java.util.List;

public interface CustomerService {

    Customer createCustomer(Customer customer);
    Customer updateCustomer(Long id, Customer customer) throws Exception;
    void deleteCustomer(Long id) throws Exception;
    Customer getCustomer(Long id) throws Exception;
    List<Customer> getAllCustomers() throws Exception;
    List<Customer> searchCustomers(String keyword) throws Exception;
    PageResponse<CustomerDTO> getCustomersPaged(String keyword, int page, int size, String sortBy, String sortDir) throws Exception;
    CustomerSummaryDTO getCustomerSummary() throws Exception;
}
