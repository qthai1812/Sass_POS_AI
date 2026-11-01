package com.zosh.configuration;

import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

public final class JwtConstant {

    private static final Logger log = LoggerFactory.getLogger(JwtConstant.class);
    public static final String JWT_HEADER = "Authorization";

    private static volatile SecretKey secretKey = initDefaultKey();

    private JwtConstant() {
    }

    private static SecretKey initDefaultKey() {
        String configured = System.getProperty("app.jwt.secret");
        if (configured == null || configured.isBlank()) {
            configured = System.getenv("JWT_SECRET");
        }
        if (configured != null && !configured.isBlank()) {
            byte[] bytes = configured.trim().getBytes(StandardCharsets.UTF_8);
            if (bytes.length >= 32) {
                return Keys.hmacShaKeyFor(bytes);
            }
            log.warn("Configured JWT_SECRET is shorter than 32 bytes; padding via SHA-256 derivation is recommended. Generating ephemeral 512-bit key instead.");
        } else {
            log.warn("JWT_SECRET environment variable is not set. Using an ephemeral runtime 512-bit signing key (tokens will reset on server restart). Set JWT_SECRET in production.");
        }
        byte[] randomBytes = new byte[64];
        new SecureRandom().nextBytes(randomBytes);
        return Keys.hmacShaKeyFor(randomBytes);
    }

    public static synchronized void configureSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            return;
        }
        byte[] bytes = secret.trim().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must be at least 32 bytes (256 bits) for HMAC-SHA security");
        }
        secretKey = Keys.hmacShaKeyFor(bytes);
    }

    public static SecretKey getSecretKey() {
        return secretKey;
    }
}
