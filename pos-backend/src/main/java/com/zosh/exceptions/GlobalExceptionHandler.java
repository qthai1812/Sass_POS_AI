package com.zosh.exceptions;

import com.zosh.payload.response.ApiResponse;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.PessimisticLockException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserException.class)
    public ResponseEntity<ApiResponse> handleUserException(UserException ex) {
        return buildResponse(ex.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse> handleBadCredentials(BadCredentialsException ex) {
        return buildResponse(ex.getMessage(), HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse> handleAccessDenied(AccessDeniedException ex) {
        String raw = ex.getMessage();
        // "Access Denied" là thông điệp mặc định của Spring Security (@PreAuthorize) -> dùng thông điệp chung;
        // các thông điệp nghiệp vụ do ứng dụng chủ động ném (thanh toán, webhook, phân quyền...) được giữ nguyên.
        String message = (raw != null && !raw.isBlank() && !"Access Denied".equalsIgnoreCase(raw.trim()))
                ? raw
                : "You do not have permission to perform this action";
        return buildResponse(message, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler({EntityNotFoundException.class, NoSuchElementException.class, NoResourceFoundException.class})
    public ResponseEntity<ApiResponse> handleNotFound(Exception ex) {
        return buildResponse(ex.getMessage() != null ? ex.getMessage() : "Resource not found", HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse> handleValidationException(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return buildResponse(message, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            MissingRequestHeaderException.class,
            IllegalArgumentException.class,
            IllegalStateException.class
    })
    public ResponseEntity<ApiResponse> handleBadRequestExceptions(Exception ex) {
        String message = ex.getMessage() != null ? ex.getMessage() : "Invalid request payload or parameters";
        return buildResponse(message, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return buildResponse(ex.getMessage() != null ? ex.getMessage() : "Request method not supported", HttpStatus.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        return buildResponse("Uploaded file exceeds the maximum allowed size (5MB)", HttpStatus.PAYLOAD_TOO_LARGE);
    }

    @ExceptionHandler({OptimisticLockException.class, PessimisticLockException.class})
    public ResponseEntity<ApiResponse> handleConcurrencyException(Exception ex) {
        log.warn("Concurrency conflict detected: {}", ex.getMessage());
        return buildResponse("Resource is being updated by another transaction. Please retry.", HttpStatus.CONFLICT);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Database constraint violation: {}", ex.getMessage());
        return buildResponse("Data integrity violation: duplicate or invalid reference data.", HttpStatus.CONFLICT);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse> handleGenericException(Exception ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "";
        String lower = msg.toLowerCase();

        // Phân loại thông minh các ngoại lệ nghiệp vụ đang ném bằng 'new Exception(...)'
        if (lower.contains("not found") || lower.contains("not exist") || lower.contains("doesn't exist")
                || lower.contains("no active shift") || lower.contains("no account found")) {
            return buildResponse(msg, HttpStatus.NOT_FOUND);
        }
        if (lower.contains("permission") || lower.contains("only store admin")
                || lower.contains("not authorized") || lower.contains("cannot assign role_super_admin") || lower.contains("cannot assign role_admin")
                || lower.contains("blocked")) {
            return buildResponse(msg, HttpStatus.FORBIDDEN);
        }
        if (lower.contains("already") || lower.contains("insufficient stock")
                || lower.contains("invalid") || lower.contains("expired")
                || lower.contains("disabled") || lower.contains("minimum")
                || lower.contains("exceeds") || lower.contains("required")
                || lower.contains("not active") || lower.contains("not supported")
                || lower.contains("loyalty") || lower.contains("redeem")
                || lower.contains("points") || lower.contains("select a customer")
                || lower.contains("cannot") || lower.contains("must")
                || lower.contains("does not belong") || lower.contains("no longer available")
                || lower.contains("not assigned") || lower.contains("failed to deduct inventory")
                || lower.contains("pending") || lower.contains("vui lòng")
                || lower.contains("bắt đầu ca") || lower.contains("chờ")
                || lower.contains("không thể") || lower.contains("đã tồn tại")
                || lower.contains("không xác định") || lower.contains("không thuộc")
                || lower.contains("vượt quá") || lower.contains("tối đa")
                || lower.contains("tối thiểu") || lower.contains("hết hạn")) {
            return buildResponse(msg, HttpStatus.BAD_REQUEST);
        }

        // Lỗi hệ thống thực sự: ghi log chi tiết và ẩn chi tiết nhạy cảm khỏi client
        log.error("Unhandled internal server error: ", ex);
        return buildResponse("An unexpected internal server error occurred", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<ApiResponse> buildResponse(String message, HttpStatus status) {
        ApiResponse response = new ApiResponse();
        response.setMessage(message);
        return new ResponseEntity<>(response, status);
    }
}
