package com.zosh.service.auth;

import com.zosh.exceptions.UserException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SendGridEmailServiceTest {

    @Mock
    private RestTemplate restTemplate;

    @Test
    void isConfigured_checksApiKeyAndMailFrom() {
        assertFalse(new SendGridEmailService(restTemplate, "abcd", "a@b.com", "POS").isConfigured());
        assertFalse(new SendGridEmailService(restTemplate, "SG.valid", "", "POS").isConfigured());
        assertTrue(new SendGridEmailService(restTemplate, "SG.valid", "no-reply@pos.vn", "POS").isConfigured());
    }

    @Test
    void buildOtpEmailHtml_escapesHtmlAndIncludesOtp() {
        SendGridEmailService service = new SendGridEmailService(restTemplate, "SG.k", "a@b.vn", "POS");
        String html = service.buildOtpEmailHtml("<script>alert(1)</script>", "654321");

        assertFalse(html.contains("<script>"));
        assertTrue(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertTrue(html.contains("654321"));
    }

    @Test
    void sendOtpEmail_succeedsOn2xxResponse() throws UserException {
        SendGridEmailService service = new SendGridEmailService(restTemplate, "SG.valid", "no-reply@pos.vn", "POS Pro");
        when(restTemplate.postForEntity(eq(SendGridEmailService.SENDGRID_API_URL), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.accepted().build());

        assertDoesNotThrow(() -> service.sendOtpEmail("user@pos.vn", "Minh", "123456"));
        verify(restTemplate).postForEntity(eq(SendGridEmailService.SENDGRID_API_URL), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void sendEmailViaSendGridApi_maps401And403ToReadableUserExceptions() {
        SendGridEmailService service = new SendGridEmailService(restTemplate, "SG.bad", "no-reply@pos.vn", "POS Pro");

        when(restTemplate.postForEntity(eq(SendGridEmailService.SENDGRID_API_URL), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", null,
                        "bad key".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));
        UserException ex401 = assertThrows(UserException.class,
                () -> service.sendEmailViaSendGridApi("u@pos.vn", "sub", "<p>hi</p>"));
        assertTrue(ex401.getMessage().contains("401"));

        when(restTemplate.postForEntity(eq(SendGridEmailService.SENDGRID_API_URL), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.FORBIDDEN, "Forbidden", null,
                        "unverified sender".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));
        UserException ex403 = assertThrows(UserException.class,
                () -> service.sendEmailViaSendGridApi("u@pos.vn", "sub", "<p>hi</p>"));
        assertTrue(ex403.getMessage().contains("403"));
    }
}
