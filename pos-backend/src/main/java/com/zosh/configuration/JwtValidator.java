package com.zosh.configuration;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtValidator extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(JwtConstant.JWT_HEADER);

        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String jwt = header.substring(BEARER_PREFIX.length()).trim();
            if (!jwt.isEmpty()) {
                try {
                    Claims claims = Jwts.parser()
                            .verifyWith(JwtConstant.getSecretKey())
                            .build()
                            .parseSignedClaims(jwt)
                            .getPayload();

                    Object rawEmail = claims.get("email");
                    String email = rawEmail != null ? String.valueOf(rawEmail).trim() : "";
                    String authorities = claims.get("authorities") != null
                            ? String.valueOf(claims.get("authorities"))
                            : "";

                    if (!email.isEmpty() && !"null".equalsIgnoreCase(email)) {
                        List<GrantedAuthority> auths = AuthorityUtils.commaSeparatedStringToAuthorityList(authorities);
                        Authentication auth = new UsernamePasswordAuthenticationToken(email, null, auths);
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    } else {
                        SecurityContextHolder.clearContext();
                        request.setAttribute("jwt_error", "Invalid JWT token claims");
                    }
                } catch (Exception e) {
                    SecurityContextHolder.clearContext();
                    request.setAttribute("jwt_error", "Invalid or expired JWT token");
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
