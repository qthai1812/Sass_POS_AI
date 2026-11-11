package com.zosh.service.ai;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GeminiClientTest {

    @Mock
    private RestTemplate restTemplate;

    @Test
    void tryGenerateSummary_blankApiKey_returnsNullWithoutCallingApi() {
        GeminiClient client = new GeminiClient(restTemplate, "   ", "gemini-2.5-flash");

        assertNull(client.tryGenerateSummary("Summarize sales"));
        verifyNoInteractions(restTemplate);
    }

    @Test
    void tryGenerateSummary_validResponse_extractsTrimmedCandidateText() {
        GeminiClient client = new GeminiClient(restTemplate, "AIzaTestKey", "gemini-2.5-flash");
        String json = """
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          { "text": "  Doanh thu tăng trưởng ổn định.  " }
                        ]
                      }
                    }
                  ]
                }
                """;
        when(restTemplate.postForEntity(contains("gemini-2.5-flash:generateContent?key=AIzaTestKey"),
                any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok(json));

        String result = client.tryGenerateSummary("Summarize");

        assertEquals("Doanh thu tăng trưởng ổn định.", result);
    }

    @Test
    void tryGenerateSummary_networkFailure_fallsBackGracefullyToNull() {
        GeminiClient client = new GeminiClient(restTemplate, "AIzaTestKey", "");
        when(restTemplate.postForEntity(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RestClientException("Timeout"));

        assertNull(client.tryGenerateSummary("Summarize"));
    }
}
