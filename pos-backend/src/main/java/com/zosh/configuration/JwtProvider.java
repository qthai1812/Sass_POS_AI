package com.zosh.configuration;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

@Service
public class JwtProvider {

    @Value("${app.jwt.secret:}")
    private String configuredJwtSecret;

    @PostConstruct
    public void init() {
        if (configuredJwtSecret != null && !configuredJwtSecret.isBlank()) {
            JwtConstant.configureSecret(configuredJwtSecret);
        }
    }

    public String generateToken(Authentication authentication) {
        Collection<? extends GrantedAuthority> authorities =
                authentication.getAuthorities();

        String roles = populateAuthorities(authorities);
        return Jwts.builder()
                .issuedAt(new Date())
                .expiration(new Date(new Date().getTime() + 86400000))
                .claim("email", authentication.getName())
                .claim("authorities", roles)
                .signWith(JwtConstant.getSecretKey())
                .compact();
    }

    public String getEmailFromToken(String jwt) {
        if (jwt == null || jwt.trim().isEmpty()) {
            return null;
        }
        if (jwt.startsWith("Bearer ")) {
            jwt = jwt.substring(7).trim();
        }
        if (jwt.isEmpty()) {
            return null;
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(JwtConstant.getSecretKey())
                    .build()
                    .parseSignedClaims(jwt)
                    .getPayload();

            Object email = claims.get("email");
            return email != null ? String.valueOf(email) : null;
        } catch (Exception e) {
            return null;
        }
    }

    public java.util.Date getIssuedAtFromToken(String jwt) {
        if (jwt != null && jwt.startsWith("Bearer ")) {
            jwt = jwt.substring(7);
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(JwtConstant.getSecretKey())
                    .build()
                    .parseSignedClaims(jwt)
                    .getPayload();
            return claims.getIssuedAt();
        } catch (Exception e) {
            return null;
        }
    }

    private String populateAuthorities(Collection<? extends GrantedAuthority> authorities) {
        Set<String> auths = new HashSet<>();
        for (GrantedAuthority authority : authorities) {
            auths.add(authority.getAuthority());
        }
        return String.join(",", auths);
    }
}
