export const getPaymentMethodLabel = (method) => {
  switch (method?.toLowerCase()) {
    case "cash":
      return "Tiền mặt (Cash)";
    case "card":
      return "Thẻ Visa / Ghi nợ";
    case "upi":
      return "MoMo QR";
    default:
      return method;
  }
};
