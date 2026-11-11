export const BRANCH_PRINTER_STORAGE_KEY = "pos_branch_settings_printer";

export const DEFAULT_PRINTER_SETTINGS = {
  printerName: "Epson TM-T88VI",
  paperSize: "80mm",
  printLogo: true,
  printCustomerDetails: true,
  printItemizedTax: true,
  footerText: "Thank you for shopping with us!",
};

const VALID_PAPER_SIZES = new Set(["58mm", "80mm"]);

export const normalizePrinterSettings = (raw) => {
  const merged = {
    ...DEFAULT_PRINTER_SETTINGS,
    ...(raw && typeof raw === "object" ? raw : {}),
  };
  return {
    ...merged,
    printerName: String(merged.printerName || DEFAULT_PRINTER_SETTINGS.printerName),
    paperSize: VALID_PAPER_SIZES.has(merged.paperSize)
      ? merged.paperSize
      : DEFAULT_PRINTER_SETTINGS.paperSize,
    printLogo: Boolean(merged.printLogo),
    printCustomerDetails: Boolean(merged.printCustomerDetails),
    printItemizedTax: Boolean(merged.printItemizedTax),
    footerText:
      merged.footerText === undefined || merged.footerText === null
        ? DEFAULT_PRINTER_SETTINGS.footerText
        : String(merged.footerText),
  };
};

export const getBranchPrinterSettings = () => {
  try {
    const raw = localStorage.getItem(BRANCH_PRINTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
    return normalizePrinterSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
};

export const saveBranchPrinterSettings = (settings) => {
  const normalized = normalizePrinterSettings(settings);
  localStorage.setItem(
    BRANCH_PRINTER_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  return normalized;
};
