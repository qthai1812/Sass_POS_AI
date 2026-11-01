import { formatDate, getPaymentModeLabel } from "../data";
import { styles } from "./pdfStyles";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";

// Built-in Helvetica supports WinAnsi/Latin-1; normalize Vietnamese diacritics so offline PDF rendering never garbles glyphs
const toSafePdfText = (input) => {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const formatVndPdf = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")} VND`;

// branding: { storeName } chỉ được truyền khi gói cước của cửa hàng bật Invoice Branding
export const OrderPDF = ({ order, branding }) => {
  const items = order?.items || [];
  const computedSubTotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 1);
    const unitPrice =
      item.product?.sellingPrice ??
      (item.price && qty ? item.price / qty : item.price) ??
      0;
    const lineTotal = item.price ?? unitPrice * qty;
    return sum + Number(lineTotal || 0);
  }, 0);

  const subTotal =
    order?.subTotal !== undefined && order?.subTotal !== null
      ? Number(order.subTotal)
      : computedSubTotal;
  const taxAmount = Number(order?.taxAmount || 0);
  const discountAmount = Number(order?.discountAmount || 0);
  const totalAmount = Number(order?.totalAmount ?? subTotal + taxAmount - discountAmount);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {branding?.storeName ? (
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
            {toSafePdfText(branding.storeName)}
          </Text>
        ) : null}
        <View style={styles.header}>
          <Text>Order Details - #{order?.id}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Order Information</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {formatDate(order?.createdAt)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>
                {toSafePdfText(order?.status || "COMPLETED")}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Payment Method:</Text>
              <Text style={styles.infoValue}>
                {getPaymentModeLabel(order?.paymentType)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Subtotal:</Text>
              <Text style={styles.infoValue}>{formatVndPdf(subTotal)}</Text>
            </View>
            {taxAmount > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tax:</Text>
                <Text style={styles.infoValue}>{formatVndPdf(taxAmount)}</Text>
              </View>
            )}
            {discountAmount > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  Discount
                  {order?.couponCode
                    ? ` (${toSafePdfText(order.couponCode)})`
                    : ""}
                  :
                </Text>
                <Text style={styles.infoValue}>
                  -{formatVndPdf(discountAmount)}
                </Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>{formatVndPdf(totalAmount)}</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>
                {toSafePdfText(order?.customer?.fullName || "Walk-in Customer")}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>
                {toSafePdfText(order?.customer?.phone || "N/A")}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>
                {toSafePdfText(order?.customer?.email || "N/A")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellImage}>Image</Text>
              <Text style={styles.tableCell}>Item</Text>
              <Text style={styles.tableCellCenter}>Quantity</Text>
              <Text style={styles.tableCellRight}>Price</Text>
              <Text style={styles.tableCellRight}>Total</Text>
            </View>
            {items.map((item, index) => {
              const qty = Number(item.quantity || 1);
              const unitPrice =
                item.product?.sellingPrice ??
                (item.price && qty ? item.price / qty : item.price) ??
                0;
              const lineTotal = item.price ?? unitPrice * qty;
              const rawName =
                item.productName || item.product?.name || "Product";
              const safeName = toSafePdfText(rawName);

              return (
                <View key={item.id || index} style={styles.tableRow}>
                  <View style={styles.tableCellImage}>
                    {item.product?.image ? (
                      <Image
                        src={item.product.image}
                        style={styles.productImage}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.placeholderText}>
                          {(safeName || "P").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={styles.productName}>{safeName}</Text>
                    {item.product?.sku && (
                      <Text style={styles.productSku}>
                        SKU: {toSafePdfText(item.product.sku)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.tableCellCenter}>{qty}</Text>
                  <Text style={styles.tableCellRight}>
                    {formatVndPdf(unitPrice)}
                  </Text>
                  <Text style={styles.tableCellRight}>
                    {formatVndPdf(lineTotal)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Page>
    </Document>
  );
};
