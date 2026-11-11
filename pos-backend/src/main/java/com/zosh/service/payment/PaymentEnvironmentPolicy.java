package com.zosh.service.payment;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

/**
 * Kiểm soát môi trường chạy (Dev/Local vs Production) cho tính năng mô phỏng thẻ/webhook
 * và xác định Base URL phục vụ trang Checkout di động trên mạng LAN / domain public.
 */
@Component
public class PaymentEnvironmentPolicy {

    @Value("${server.port:5000}")
    private int serverPort;

    @Value("${app.backend-url:}")
    private String publicBackendUrl;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Value("${app.payment.enable-simulation:false}")
    private boolean enableSimulation;

    public PaymentEnvironmentPolicy() {
    }

    PaymentEnvironmentPolicy(int serverPort, String publicBackendUrl, String frontendUrl,
                             String activeProfile, boolean enableSimulation) {
        this.serverPort = serverPort;
        this.publicBackendUrl = publicBackendUrl;
        this.frontendUrl = frontendUrl;
        this.activeProfile = activeProfile;
        this.enableSimulation = enableSimulation;
    }

    public boolean isSimulationAllowed() {
        if (activeProfile != null) {
            String prof = activeProfile.toLowerCase();
            if (prof.contains("prod") || prof.contains("production")) {
                return false;
            }
        }
        if (publicBackendUrl != null && !publicBackendUrl.isBlank()
                && !publicBackendUrl.contains("localhost")
                && !publicBackendUrl.contains("127.0.0.1")) {
            return false;
        }
        if (frontendUrl != null && !frontendUrl.isBlank()
                && !frontendUrl.contains("localhost")
                && !frontendUrl.contains("127.0.0.1")) {
            return false;
        }
        return enableSimulation
                || activeProfile == null
                || activeProfile.toLowerCase().contains("dev")
                || activeProfile.toLowerCase().contains("local");
    }

    public String resolveBackendBaseUrl() {
        if (publicBackendUrl != null && !publicBackendUrl.isBlank()) {
            return publicBackendUrl.trim().replaceAll("/+$", "");
        }
        return String.format("http://%s:%d", detectLanIp(), serverPort);
    }

    public String detectLanIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) {
                    continue;
                }
                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String ip = addr.getHostAddress();
                        if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "localhost";
    }
}
