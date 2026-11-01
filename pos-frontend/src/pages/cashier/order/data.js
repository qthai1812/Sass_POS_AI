export const getStatusBadgeVariant = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED":
    case "COMPLETE":
      return "default";
    case "PENDING":
      return "outline";
    case "CANCELLED":
      return "destructive";
    case "REFUNDED":
      return "secondary";
    default:
      return "secondary";
  }
};

export const getStatusColor = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED":
    case "COMPLETE":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "CANCELLED":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "REFUNDED":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    default:
      return "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
  }
};

export const formatDate = (date) => {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getPaymentModeLabel = (mode) => {
  switch (String(mode || "").toUpperCase()) {
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "UPI":
      return "UPI";
    default:
      return mode || "Cash";
  }
};
