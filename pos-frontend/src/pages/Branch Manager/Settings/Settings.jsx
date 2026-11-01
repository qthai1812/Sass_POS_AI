import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building, Printer, Receipt, CreditCard, Save } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { getBranchById } from "@/Redux Toolkit/features/branch/branchThunks";
import { useToast } from "@/components/ui/use-toast";
import BranchInfo from "./BranchInfo";

const STORAGE_KEY_PREFIX = "pos_branch_settings_";

const Settings = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { userProfile } = useSelector((state) => state.user);
  const { branch } = useSelector((state) => state.branch);

  useEffect(() => {
    if (userProfile?.branchId && localStorage.getItem("jwt")) {
      dispatch(
        getBranchById({
          id: userProfile.branchId,
          jwt: localStorage.getItem("jwt"),
        })
      );
    }
  }, [dispatch, userProfile]);

  const [printerSettings, setPrinterSettings] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}printer`);
    return saved
      ? JSON.parse(saved)
      : {
          printerName: "Epson TM-T88VI",
          paperSize: "80mm",
          printLogo: true,
          printCustomerDetails: true,
          printItemizedTax: true,
          footerText: "Thank you for shopping with us!",
        };
  });

  const [taxSettings, setTaxSettings] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}tax`);
    return saved
      ? JSON.parse(saved)
      : {
          gstEnabled: true,
          gstPercentage: 18,
          applyGstToAll: true,
          showTaxBreakdown: true,
        };
  });

  const [paymentSettings, setPaymentSettings] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}payment`);
    return saved
      ? JSON.parse(saved)
      : {
          acceptCash: true,
          acceptUPI: true,
          acceptCard: true,
          upiId: "example@upi",
          cardTerminalId: "TERM12345",
        };
  });

  const [discountSettings, setDiscountSettings] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}discount`);
    return saved
      ? JSON.parse(saved)
      : {
          allowDiscount: true,
          maxDiscountPercentage: 10,
          requireManagerApproval: true,
          discountReasons: [
            "Damaged Product",
            "Bulk Purchase",
            "Regular Customer",
            "Promotional Offer",
          ],
        };
  });

  const handlePrinterSettingsChange = (field, value) => {
    setPrinterSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleTaxSettingsChange = (field, value) => {
    setTaxSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handlePaymentSettingsChange = (field, value) => {
    setPaymentSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleDiscountSettingsChange = (field, value) => {
    setDiscountSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = (settingType) => {
    const map = {
      printer: printerSettings,
      tax: taxSettings,
      payment: paymentSettings,
      discount: discountSettings,
    };
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${settingType}`,
      JSON.stringify(map[settingType])
    );
    toast({
      title: "Settings Saved",
      description: `Branch ${settingType} configuration has been saved successfully for ${
        branch?.name || "this branch"
      }.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Branch Settings</h1>
      </div>

      <Tabs defaultValue="branch-info">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="branch-info" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Branch Info
          </TabsTrigger>
          <TabsTrigger value="printer" className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Printer
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tax
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="discount" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Discount
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branch-info">
          <BranchInfo />
        </TabsContent>

        <TabsContent value="printer">
          <Card>
            <CardHeader>
              <CardTitle>POS Printer Settings</CardTitle>
              <CardDescription>Configure your receipt printer settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="printer-name" className="text-sm font-medium">
                      Printer Name
                    </label>
                    <Input
                      id="printer-name"
                      value={printerSettings.printerName}
                      onChange={(e) =>
                        handlePrinterSettingsChange("printerName", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="paper-size" className="text-sm font-medium">
                      Paper Size
                    </label>
                    <Select
                      value={printerSettings.paperSize}
                      onValueChange={(value) =>
                        handlePrinterSettingsChange("paperSize", value)
                      }
                    >
                      <SelectTrigger id="paper-size">
                        <SelectValue placeholder="Select paper size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">58mm</SelectItem>
                        <SelectItem value="80mm">80mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="print-logo" className="text-sm font-medium">
                      Print Logo on Receipt
                    </label>
                    <Switch
                      id="print-logo"
                      checked={printerSettings.printLogo}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange("printLogo", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="print-customer" className="text-sm font-medium">
                      Print Customer Details
                    </label>
                    <Switch
                      id="print-customer"
                      checked={printerSettings.printCustomerDetails}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange("printCustomerDetails", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="print-tax" className="text-sm font-medium">
                      Print Itemized Tax
                    </label>
                    <Switch
                      id="print-tax"
                      checked={printerSettings.printItemizedTax}
                      onCheckedChange={(checked) =>
                        handlePrinterSettingsChange("printItemizedTax", checked)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="footer-text" className="text-sm font-medium">
                    Receipt Footer Text
                  </label>
                  <Input
                    id="footer-text"
                    value={printerSettings.footerText}
                    onChange={(e) =>
                      handlePrinterSettingsChange("footerText", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => handleSaveSettings("printer")}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>Tax Settings</CardTitle>
              <CardDescription>Configure tax rates and rules for your branch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="gst-enabled" className="text-sm font-medium">
                    Enable GST
                  </label>
                  <Switch
                    id="gst-enabled"
                    checked={taxSettings.gstEnabled}
                    onCheckedChange={(checked) =>
                      handleTaxSettingsChange("gstEnabled", checked)
                    }
                  />
                </div>

                {taxSettings.gstEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-gray-100">
                    <div className="space-y-2">
                      <label htmlFor="gst-percentage" className="text-sm font-medium">
                        GST Percentage (%)
                      </label>
                      <Input
                        id="gst-percentage"
                        type="number"
                        min="0"
                        max="100"
                        value={taxSettings.gstPercentage}
                        onChange={(e) =>
                          handleTaxSettingsChange(
                            "gstPercentage",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label htmlFor="apply-gst-all" className="text-sm font-medium">
                        Apply GST to All Products
                      </label>
                      <Switch
                        id="apply-gst-all"
                        checked={taxSettings.applyGstToAll}
                        onCheckedChange={(checked) =>
                          handleTaxSettingsChange("applyGstToAll", checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label htmlFor="show-tax-breakdown" className="text-sm font-medium">
                        Show Tax Breakdown on Receipt
                      </label>
                      <Switch
                        id="show-tax-breakdown"
                        checked={taxSettings.showTaxBreakdown}
                        onCheckedChange={(checked) =>
                          handleTaxSettingsChange("showTaxBreakdown", checked)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => handleSaveSettings("tax")}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Configure accepted payment methods for your branch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="accept-cash" className="text-sm font-medium">
                    Accept Cash Payments
                  </label>
                  <Switch
                    id="accept-cash"
                    checked={paymentSettings.acceptCash}
                    onCheckedChange={(checked) =>
                      handlePaymentSettingsChange("acceptCash", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="accept-upi" className="text-sm font-medium">
                    Accept UPI Payments
                  </label>
                  <Switch
                    id="accept-upi"
                    checked={paymentSettings.acceptUPI}
                    onCheckedChange={(checked) =>
                      handlePaymentSettingsChange("acceptUPI", checked)
                    }
                  />
                </div>

                {paymentSettings.acceptUPI && (
                  <div className="space-y-2 pl-6 border-l-2 border-gray-100">
                    <label htmlFor="upi-id" className="text-sm font-medium">
                      Branch UPI ID
                    </label>
                    <Input
                      id="upi-id"
                      value={paymentSettings.upiId}
                      onChange={(e) =>
                        handlePaymentSettingsChange("upiId", e.target.value)
                      }
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label htmlFor="accept-card" className="text-sm font-medium">
                    Accept Card Payments
                  </label>
                  <Switch
                    id="accept-card"
                    checked={paymentSettings.acceptCard}
                    onCheckedChange={(checked) =>
                      handlePaymentSettingsChange("acceptCard", checked)
                    }
                  />
                </div>

                {paymentSettings.acceptCard && (
                  <div className="space-y-2 pl-6 border-l-2 border-gray-100">
                    <label htmlFor="terminal-id" className="text-sm font-medium">
                      Card Terminal ID
                    </label>
                    <Input
                      id="terminal-id"
                      value={paymentSettings.cardTerminalId}
                      onChange={(e) =>
                        handlePaymentSettingsChange("cardTerminalId", e.target.value)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => handleSaveSettings("payment")}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discount">
          <Card>
            <CardHeader>
              <CardTitle>Discount Rules</CardTitle>
              <CardDescription>Configure discount policies for your branch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="allow-discount" className="text-sm font-medium">
                    Allow Discounts
                  </label>
                  <Switch
                    id="allow-discount"
                    checked={discountSettings.allowDiscount}
                    onCheckedChange={(checked) =>
                      handleDiscountSettingsChange("allowDiscount", checked)
                    }
                  />
                </div>

                {discountSettings.allowDiscount && (
                  <div className="space-y-4 pl-6 border-l-2 border-gray-100">
                    <div className="space-y-2">
                      <label htmlFor="max-discount" className="text-sm font-medium">
                        Maximum Discount Percentage (%)
                      </label>
                      <Input
                        id="max-discount"
                        type="number"
                        min="0"
                        max="100"
                        value={discountSettings.maxDiscountPercentage}
                        onChange={(e) =>
                          handleDiscountSettingsChange(
                            "maxDiscountPercentage",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label htmlFor="manager-approval" className="text-sm font-medium">
                        Require Manager Approval for Discounts
                      </label>
                      <Switch
                        id="manager-approval"
                        checked={discountSettings.requireManagerApproval}
                        onCheckedChange={(checked) =>
                          handleDiscountSettingsChange("requireManagerApproval", checked)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Discount Reasons</label>
                      <div className="space-y-2">
                        {discountSettings.discountReasons.map((reason, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={reason}
                              onChange={(e) => {
                                const updatedReasons = [
                                  ...discountSettings.discountReasons,
                                ];
                                updatedReasons[index] = e.target.value;
                                handleDiscountSettingsChange(
                                  "discountReasons",
                                  updatedReasons
                                );
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updatedReasons =
                                  discountSettings.discountReasons.filter(
                                    (_, i) => i !== index
                                  );
                                handleDiscountSettingsChange(
                                  "discountReasons",
                                  updatedReasons
                                );
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleDiscountSettingsChange("discountReasons", [
                              ...discountSettings.discountReasons,
                              "",
                            ]);
                          }}
                        >
                          Add Reason
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => handleSaveSettings("discount")}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
