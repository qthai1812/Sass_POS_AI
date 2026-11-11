import { useEffect } from "react";
import api from "@/utils/api";
import { mergeGatewaySession } from "@/utils/paymentGatewayUtils";

export function useMomoWebhookPolling({
  enabled,
  gatewaySession,
  onSessionChange,
  onSuccess,
  intervalMs = 1500,
}) {
  useEffect(() => {
    if (
      !enabled ||
      !gatewaySession?.sessionId ||
      gatewaySession.status === "SUCCESS" ||
      gatewaySession.status === "FAILED"
    ) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await api.get(
          `/api/payment-gateway/sessions/${gatewaySession.sessionId}`,
        );
        const updated = res.data;
        if (updated && updated.status !== gatewaySession.status) {
          onSessionChange((prev) => mergeGatewaySession(prev, updated));
          if (updated.status === "SUCCESS") {
            clearInterval(timer);
            onSuccess?.(updated);
          }
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời khi đang polling
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, gatewaySession, onSessionChange, onSuccess, intervalMs]);
}
