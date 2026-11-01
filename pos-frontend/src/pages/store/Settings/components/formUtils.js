// Transform settings data to API format
export const transformSettingsToApiFormat = (settings, currentStoreType) => {
  const parsedTax = parseFloat(settings.taxRate);
  return {
    brand: settings.storeName,
    description: settings.storeDescription,
    storeType: currentStoreType || settings.storeType || "Retail Store",
    contact: {
      address: settings.storeAddress,
      phone: settings.storePhone,
      email: settings.storeEmail,
    },
    currency: settings.currency || "VND",
    taxRate: Number.isFinite(parsedTax) ? Math.max(0, parsedTax) : 10,
    timezone: settings.timezone || "Asia/Ho_Chi_Minh",
    dateFormat: settings.dateFormat || "DD/MM/YYYY",
    receiptFooter: settings.receiptFooter || "",
  };
};

// Transform API data to settings format
export const transformApiToSettingsFormat = (apiData) => {
  return {
    storeName: apiData.brand || "",
    storeEmail: apiData.contact?.email || "",
    storePhone: apiData.contact?.phone || "",
    storeAddress: apiData.contact?.address || "",
    storeDescription: apiData.description || "",
    currency: apiData.currency || "VND",
    taxRate:
      apiData.taxRate !== undefined && apiData.taxRate !== null
        ? String(apiData.taxRate)
        : "10",
    timezone: apiData.timezone || "Asia/Ho_Chi_Minh",
    dateFormat: apiData.dateFormat || "DD/MM/YYYY",
    receiptFooter: apiData.receiptFooter || "",
  };
};

// Get initial values for the form
export const getInitialValues = (storeData) => {
  if (!storeData) {
    return {
      storeName: "",
      storeEmail: "",
      storePhone: "",
      storeAddress: "",
      storeDescription: "",
      currency: "VND",
      taxRate: "10",
      timezone: "Asia/Ho_Chi_Minh",
      dateFormat: "DD/MM/YYYY",
      receiptFooter: "",
    };
  }

  return transformApiToSettingsFormat(storeData);
};
