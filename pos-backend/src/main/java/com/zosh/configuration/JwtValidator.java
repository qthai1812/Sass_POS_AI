package com.zosh.configuration;

import com.zosh.modal.User;
import com.zosh.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

public class JwtValidator extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final UserRepository userRepository;

    public JwtValidator() {
        this.userRepository = null;
    }

    public JwtValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

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
                            ? normalizeRoleAuthorities(String.valueOf(claims.get("authorities")))
                            : "";
                    Date issuedAt = claims.getIssuedAt();

                    if (!email.isEmpty() && !"null".equalsIgnoreCase(email)) {
                        if (userRepository != null) {
                            User user = userRepository.findByEmail(email);
                            if (user == null) {
                                SecurityContextHolder.clearContext();
                                request.setAttribute("jwt_error", "User account no longer exists");
                                filterChain.doFilter(request, response);
                                return;
                            }
                            if (Boolean.FALSE.equals(user.getLoginAccess())) {
                                SecurityContextHolder.clearContext();
                                request.setAttribute("jwt_error", "Login access for this account has been disabled by your manager.");
                                filterChain.doFilter(request, response);
                                return;
                            }
                            if (user.getPasswordChangedAt() != null && issuedAt != null) {
                                LocalDateTime tokenIssuedTime = LocalDateTime.ofInstant(
                                        issuedAt.toInstant(), ZoneId.systemDefault()
                                );
                                if (tokenIssuedTime.isBefore(user.getPasswordChangedAt().minusSeconds(1))) {
                                    SecurityContextHolder.clearContext();
                                    request.setAttribute("jwt_error", "Phiên đăng nhập đã hết hiệu lực do mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại.");
                                    filterChain.doFilter(request, response);
                                    return;
                                }
                            }
                        }
                        List<GrantedAuthority> auths = AuthorityUtils.commaSeparatedStringToAuthorityList(authorities);
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(email, null, auths);
                        auth.setDetails(issuedAt);
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

    private String normalizeRoleAuthorities(String rawAuthorities) {
        if (rawAuthorities == null || rawAuthorities.isBlank()) {
            return "";
        }
        return rawAuthorities
                .replace("ROLE_STORE_ADMIN", "ROLE_STORE_OWNER")
                .replace("ROLE_STORE_MANAGER", "ROLE_STORE_OWNER")
                .replace("ROLE_BRANCH_CASHIER", "ROLE_CASHIER")
                .replaceAll("\\bROLE_ADMIN\\b", "ROLE_SUPER_ADMIN");
    }
}
