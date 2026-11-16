package com.zosh.service;

import com.zosh.domain.OrderStatus;
import com.zosh.domain.PaymentType;
import com.zosh.payload.dto.OrderDTO;
import com.zosh.payload.response.PageResponse;

import java.time.LocalDate;
import java.util.List;

public interface OrderService {

    OrderDTO createOrder(OrderDTO orderDTO) throws Exception;
    OrderDTO getOrderById(Long id) throws Exception;
    OrderDTO updateOrderStatus(Long id, OrderStatus status) throws Exception;
    OrderDTO updateOrderStatus(Long id, OrderStatus status, PaymentType paymentType, String paymentSessionId) throws Exception;
    List<OrderDTO> getOrdersByBranch(Long branchId,
                                     Long customerId,
                                     Long cashierId,
                                     PaymentType paymentType,
                                     OrderStatus status) throws Exception;
    PageResponse<OrderDTO> getOrdersByBranchPaged(Long branchId,
                                                  Long customerId,
                                                  Long cashierId,
                                                  PaymentType paymentType,
                                                  OrderStatus status,
                                                  int page,
                                                  int size,
                                                  String sortBy,
                                                  String sortDir) throws Exception;
    PageResponse<OrderDTO> getOrdersByBranchPaged(Long branchId,
                                                  Long customerId,
                                                  Long cashierId,
                                                  PaymentType paymentType,
                                                  OrderStatus status,
                                                  String keyword,
                                                  int page,
                                                  int size,
                                                  String sortBy,
                                                  String sortDir) throws Exception;
    List<OrderDTO> getOrderByCashier(Long cashierId) throws Exception;
    PageResponse<OrderDTO> getOrdersByCashierPaged(Long cashierId,
                                                   String keyword,
                                                   LocalDate startDate,
                                                   LocalDate endDate,
                                                   int page,
                                                   int size,
                                                   String sortBy,
                                                   String sortDir) throws Exception;
    void deleteOrder(Long id) throws Exception;
    List<OrderDTO> getTodayOrdersByBranch(Long branchId) throws Exception;
    List<OrderDTO> getOrdersByCustomerId(Long customerId) throws Exception;
    List<OrderDTO> getTop5RecentOrdersByBranchId(Long branchId) throws Exception;
    int cancelExpiredPendingOrders();
}
