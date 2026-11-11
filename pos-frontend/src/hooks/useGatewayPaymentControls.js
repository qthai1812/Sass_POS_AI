import { useState, useCallback } from "react";
import api from "@/utils/api";
import {
  mergeGatewaySession,
  SAMPLE_VISA_CARD,
} from "@/utils/paymentGatewayUtils";

export function useGatewayPaymentControls() {
  const [gatewaySession, setGatewaySession] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [qrMode, setQrMode] = useState("VIETQR");
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [cardStepText, setCardStepText] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardHolder, setCardHolder] = useState("");

  const resetCardFields = useCallback(() => {
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardHolder("");
  }, []);

  const resetGatewayDisplay = useCallback(() => {
    setGatewaySession(null);
    setCardStepText("");
  }, []);

  const fillSampleCard = useCallback((defaultHolder) => {
    setCardNumber(SAMPLE_VISA_CARD.cardNumber);
    setCardExpiry(SAMPLE_VISA_CARD.cardExpiry);
    setCardCvv(SAMPLE_VISA_CARD.cardCvv);
    setCardHolder(defaultHolder);
  }, []);

  const triggerMomoWebhook = useCallback(
    async ({ providerName, status = "SUCCESS", onSuccess, onError }) => {
      if (!gatewaySession?.sessionId) return;
      setSimulatingWebhook(true);
      try {
        const res = await api.post(
          `/api/payment-gateway/webhook/${gatewaySession.sessionId}`,
          { status, providerName },
          {
            headers: {
              "X-Webhook-Signature": gatewaySession?.webhookToken || "",
            },
          },
        );
        setGatewaySession((prev) => mergeGatewaySession(prev, res.data));
        if (res.data?.status === "SUCCESS") {
          await onSuccess?.(res.data);
        }
      } catch (err) {
        onError?.(err);
      } finally {
        setSimulatingWebhook(false);
      }
    },
    [gatewaySession],
  );

  const authorizeCardWithGateway = useCallback(
    async ({
      ensureSessionId,
      verifyingStepText,
      formatSuccessStepText,
      onBusyChange,
      onSuccess,
      onDeclined,
    }) => {
      const sessionId = await ensureSessionId();
      if (!sessionId) return;

      onBusyChange(true);
      setCardStepText(
        "Đang kết nối cổng thanh toán quốc tế Visa / Mastercard...",
      );
      try {
        await new Promise((r) => setTimeout(r, 600));
        setCardStepText(verifyingStepText);
        await new Promise((r) => setTimeout(r, 700));

        const res = await api.post(
          `/api/payment-gateway/sessions/${sessionId}/authorize-card`,
          {
            cardNumber,
            expiry: cardExpiry,
            cvv: cardCvv,
            cardHolder,
          },
        );

        const updatedSession = res.data;
        setGatewaySession((prev) => mergeGatewaySession(prev, updatedSession));

        if (updatedSession?.status === "SUCCESS") {
          setCardStepText(formatSuccessStepText(updatedSession));
          await onSuccess(updatedSession);
        } else {
          onBusyChange(false);
          setCardStepText("");
          onDeclined(updatedSession?.providerMessage);
        }
      } catch (err) {
        const failedSession = err?.response?.data;
        if (failedSession) {
          setGatewaySession((prev) => mergeGatewaySession(prev, failedSession));
        }
        onDeclined(failedSession?.providerMessage);
        onBusyChange(false);
        setCardStepText("");
      }
    },
    [cardNumber, cardExpiry, cardCvv, cardHolder],
  );

  return {
    gatewaySession,
    setGatewaySession,
    creatingSession,
    setCreatingSession,
    qrMode,
    setQrMode,
    simulatingWebhook,
    cardStepText,
    cardNumber,
    setCardNumber,
    cardExpiry,
    setCardExpiry,
    cardCvv,
    setCardCvv,
    cardHolder,
    setCardHolder,
    resetCardFields,
    resetGatewayDisplay,
    fillSampleCard,
    triggerMomoWebhook,
    authorizeCardWithGateway,
  };
}
