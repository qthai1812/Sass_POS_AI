package com.zosh.controller;

import com.zosh.modal.Customer;
import com.zosh.payload.response.ApiResponse;
import com.zosh.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @PostMapping
    public ResponseEntity<Customer> createCustomer(
            @RequestBody Customer customer
    ) throws Exception {
        return ResponseEntity.ok(customerService.createCustomer(customer));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER')")
    @PutMapping("/{id}")
    public ResponseEntity<Customer> updateCustomer(
            @PathVariable Long id,
            @RequestBody Customer customer
    ) throws Exception {
        return ResponseEntity.ok(customerService.updateCustomer(id, customer));
    }

    @PreAuthorize("hasRole('STORE_OWNER')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> deleteCustomer(
            @PathVariable Long id
    ) throws Exception {
        customerService.deleteCustomer(id);
        ApiResponse apiResponse = new ApiResponse();
        apiResponse.setMessage("Customer deleted successfully");
        return ResponseEntity.ok(apiResponse);
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/{id}")
    public ResponseEntity<Customer> getCustomerById(@PathVariable Long id) throws Exception {
        return ResponseEntity.ok(customerService.getCustomer(id));
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping
    public ResponseEntity<List<Customer>> getAll() throws Exception {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @PreAuthorize("hasAnyRole('STORE_OWNER', 'BRANCH_MANAGER', 'CASHIER')")
    @GetMapping("/search")
    public ResponseEntity<List<Customer>> searchCustomers(
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(required = false) String q
    ) throws Exception {
        String query = (keyword != null && !keyword.isBlank()) ? keyword : (q != null ? q : "");
        return ResponseEntity.ok(customerService.searchCustomers(query));
    }
}
