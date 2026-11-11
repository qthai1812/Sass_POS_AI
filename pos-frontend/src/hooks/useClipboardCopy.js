import { useState, useRef, useEffect, useCallback } from "react";

export function useClipboardCopy(timeoutMs = 1800) {
  const [copiedField, setCopiedField] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    (value, key) => {
      navigator.clipboard?.writeText(String(value));
      setCopiedField(key);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopiedField(null);
      }, timeoutMs);
    },
    [timeoutMs],
  );

  return { copiedField, handleCopy };
}
