import { pdf } from "@react-pdf/renderer";
import api from "@/utils/api";

import { OrderPDF } from "./OrderPDF";
import { formatDate } from "../data";

// Chỉ in thương hiệu cửa hàng lên hóa đơn khi gói cước bật Invoice Branding
const resolveBranding = async () => {
  try {
    const { data } = await api.get("/api/subscriptions/entitlements");
    if (data?.features?.invoiceBranding !== false && data?.storeName) {
      return { storeName: data.storeName };
    }
  } catch {
    // không lấy được quyền lợi gói: xuất hóa đơn không có thương hiệu
  }
  return null;
};

const generateOrderPdfBlob = async (order) => {
  const branding = await resolveBranding();
  const pdfDoc = pdf(<OrderPDF order={order} branding={branding} />);
  return pdfDoc.toBlob();
};

export const handleDownloadOrderPDF = async (order, toast) => {
  if (!order) return;
  try {
    if (toast) {
      toast({
        title: "Generating PDF",
        description: "Please wait while we generate your PDF...",
      });
    }

    const blob = await generateOrderPdfBlob(order);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `order-${order.id}-${formatDate(order.createdAt).replace(
      /[/,: ]+/g,
      "-",
    )}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (toast) {
      toast({
        title: "PDF Downloaded",
        description: `Order #${order.id} has been downloaded as PDF`,
      });
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (toast) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  }
};

export const handlePrintOrderPDF = async (order, toast) => {
  if (!order) return;
  try {
    if (toast) {
      toast({
        title: "Preparing Invoice",
        description: `Generating printable invoice for Order #${order.id}...`,
      });
    }

    const blob = await generateOrderPdfBlob(order);
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, "_blank");
    if (printWin) {
      printWin.addEventListener("load", () => {
        try {
          printWin.focus();
          printWin.print();
        } catch {
          // Browser PDF viewer handles print controls directly
        }
      });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      URL.revokeObjectURL(url);
      await handleDownloadOrderPDF(order, toast);
    }
  } catch (error) {
    console.error("Error printing PDF:", error);
    if (toast) {
      toast({
        title: "Error",
        description: "Failed to prepare invoice for printing.",
        variant: "destructive",
      });
    }
  }
};
