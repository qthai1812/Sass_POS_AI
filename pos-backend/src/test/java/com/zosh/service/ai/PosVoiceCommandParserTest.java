package com.zosh.service.ai;

import com.zosh.modal.Customer;
import com.zosh.modal.Product;
import com.zosh.payload.dto.CouponDTO;
import com.zosh.payload.response.AiCopilotDTOs.QuickCommandResponse;
import com.zosh.repository.CustomerRepository;
import com.zosh.repository.ProductRepository;
import com.zosh.service.CouponService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PosVoiceCommandParserTest {

    @Mock private CouponService couponService;
    @Mock private CustomerRepository customerRepository;
    @Mock private ProductRepository productRepository;

    @InjectMocks
    private PosVoiceCommandParser parser;

    @Test
    void parse_fullVietnameseCommand_extractsCouponCustomerQtyProductsAndPaymentMethod() throws Exception {
        Customer cust = Customer.builder().id(10L).fullName("Nguyễn Minh").phone("0901234567").build();
        Product polo = Product.builder().id(1L).name("Áo Polo Trắng").sku("POLO-W").build();
        Product jean = Product.builder().id(2L).name("Quần Jean Xanh").sku("JEAN-B").build();
        CouponDTO coupon = CouponDTO.builder().id(5L).code("SALE10").discountValue(10.0).build();

        when(couponService.getCouponByCode("SALE10", 1L)).thenReturn(coupon);
        when(customerRepository.searchCustomersByStore(1L, "0901234567")).thenReturn(List.of(cust));
        when(productRepository.findByStoreId(1L)).thenReturn(List.of(polo, jean));

        String cmd = "lấy hai áo polo trắng, thêm 3 quần jean xanh cho khách 0901234567 áp mã sale10 thanh toán chuyển khoản";
        QuickCommandResponse res = parser.parse(1L, cmd);

        assertEquals(2, res.getMatchedItems().size());
        assertEquals(2, res.getMatchedItems().get(0).getQuantity());
        assertEquals(1L, res.getMatchedItems().get(0).getProduct().getId());
        assertEquals(3, res.getMatchedItems().get(1).getQuantity());
        assertEquals(2L, res.getMatchedItems().get(1).getProduct().getId());
        assertEquals(cust, res.getMatchedCustomer());
        assertEquals("SALE10", res.getAppliedCoupon().getCode());
        assertNull(res.getCouponError());
        assertEquals("UPI", res.getPaymentMethod());
    }

    @Test
    void parse_preservesCustomerNameWithVietnameseNumberWordAndHandlesInvalidCoupon() throws Exception {
        Customer cust = Customer.builder().id(20L).fullName("Trần Văn Năm").build();
        Product p = Product.builder().id(1L).name("Áo Hai Dây").sku("HD-01").build();

        when(couponService.getCouponByCode("EXPIRED99", 1L)).thenThrow(new Exception("Mã đã hết hạn"));
        when(customerRepository.searchCustomersByStore(1L, "Trần Văn Năm")).thenReturn(List.of(cust));
        when(productRepository.findByStoreId(1L)).thenReturn(List.of(p));

        String cmd = "lấy áo hai dây cho khách hàng Trần Văn Năm, áp mã EXPIRED99 thanh toán quẹt thẻ";
        QuickCommandResponse res = parser.parse(1L, cmd);

        assertEquals(cust, res.getMatchedCustomer());
        assertEquals(1, res.getMatchedItems().size());
        assertEquals("Áo Hai Dây", res.getMatchedItems().get(0).getProduct().getName());
        assertEquals("CARD", res.getPaymentMethod());
        assertNotNull(res.getCouponError());
        assertTrue(res.getCouponError().contains("EXPIRED99"));
    }

    @Test
    void detectPaymentMethod_coversAllMethodsAndNull() {
        assertEquals("UPI", parser.detectPaymentMethod("quét mã momo"));
        assertEquals("CARD", parser.detectPaymentMethod("trả bằng thẻ visa"));
        assertEquals("CASH", parser.detectPaymentMethod("trả tiền mặt"));
        assertNull(parser.detectPaymentMethod("lấy 2 cái áo"));
    }
}
