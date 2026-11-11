export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "completed":
    case "complete":
      return "bg-green-100 text-green-800 hover:bg-green-100/80";
    case "partially_refunded":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100/80";
    case "refunded":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100/80";
    case "cancelled":
      return "bg-red-100 text-red-800 hover:bg-red-100/80";
    case "processing":
      return "bg-primary/10 text-primary hover:bg-primary/20";
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100/80";
  }
};
