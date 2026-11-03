import api from "./api";

export const uploadFileToServer = async (file) => {
  if (!file) return null;
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await api.post("/api/media/upload", formData);
    const rawUrl = res.data?.url || (typeof res.data === "string" ? res.data : null);
    if (!rawUrl) return null;

    if (rawUrl.startsWith("/")) {
      const base = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
      return `${base}${rawUrl}`;
    }
    // Đảm bảo link trả về luôn là HTTPS khi chạy trên Vercel
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      rawUrl.startsWith("http://") &&
      !rawUrl.includes("localhost")
    ) {
      return rawUrl.replace(/^http:\/\//i, "https://");
    }
    return rawUrl;
  } catch (error) {
    console.error("Error uploading file:", error.response?.data || error.message);
    throw error;
  }
};
