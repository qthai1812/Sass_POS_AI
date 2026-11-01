import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Download, FileText, Calendar, CheckCircle } from "lucide-react";
import { useToast } from "../../components/ui/use-toast";
import { getAllStores } from "../../Redux Toolkit/features/store/storeThunks";
import { getAllSubscriptionPlans } from "../../Redux Toolkit/features/subscriptionPlan/subscriptionPlanThunks";

const exportTypes = [
  {
    id: "store-list",
    name: "Store List",
    description: "Complete list of all stores with basic information",
    format: "CSV",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "store-status",
    name: "Store Status Summary",
    description: "Summary of store statuses and registration dates",
    format: "CSV",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "commission-report",
    name: "Commission Report",
    description: "Detailed commission earnings and rates for all stores",
    format: "CSV",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "pending-requests",
    name: "Pending Requests",
    description: "List of all pending store registration requests",
    format: "CSV",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "subscription-plans",
    name: "Subscription Plans",
    description: "Configured SaaS subscription plans, pricing, and limits",
    format: "CSV",
    icon: <FileText className="w-5 h-5" />,
  },
];

export default function ExportsPage() {
  const dispatch = useDispatch();
  const { stores = [] } = useSelector((state) => state.store);
  const { plans = [] } = useSelector((state) => state.subscriptionPlan);
  const [selectedType, setSelectedType] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isExporting, setIsExporting] = useState(false);
  const [recentExports, setRecentExports] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    dispatch(getAllStores());
    dispatch(getAllSubscriptionPlans());
  }, [dispatch]);

  const buildCsvContent = (typeId, rangeOverride = dateRange) => {
    const filteredStores = (stores || []).filter((store) => {
      if (!store.createdAt) return true;
      const createdDate = new Date(store.createdAt);
      if (isNaN(createdDate.getTime())) return true;
      if (rangeOverride.from && createdDate < new Date(rangeOverride.from))
        return false;
      if (
        rangeOverride.to &&
        createdDate > new Date(`${rangeOverride.to}T23:59:59`)
      )
        return false;
      return true;
    });

    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    let rows = [];
    if (typeId === "store-status") {
      rows = [
        [
          "Store ID",
          "Brand",
          "Status",
          "Store Type",
          "Created At",
          "Updated At",
        ],
        ...filteredStores.map((s) => [
          s.id,
          s.brand || "",
          s.status || "PENDING",
          s.storeType || "",
          s.createdAt || "",
          s.updatedAt || "",
        ]),
      ];
    } else if (typeId === "commission-report") {
      rows = [
        [
          "Store ID",
          "Brand",
          "Owner",
          "Status",
          "Commission Rate (%)",
          "Total Commission Earnings (VND)",
          "Updated At",
        ],
        ...filteredStores.map((s) => [
          s.id,
          s.brand || "",
          s.storeAdmin?.fullName || "",
          s.status || "PENDING",
          s.commissionRate ?? 2.5,
          Number(s.totalEarnings ?? 0),
          s.updatedAt || s.createdAt || "",
        ]),
      ];
    } else if (typeId === "pending-requests") {
      const pending = filteredStores.filter(
        (s) => String(s.status || "").toUpperCase() === "PENDING",
      );
      rows = [
        ["Store ID", "Brand", "Owner", "Email", "Phone", "Submitted At"],
        ...pending.map((s) => [
          s.id,
          s.brand || "",
          s.storeAdmin?.fullName || "",
          s.contact?.email || "",
          s.contact?.phone || "",
          s.createdAt || "",
        ]),
      ];
    } else if (typeId === "subscription-plans") {
      rows = [
        [
          "Plan ID",
          "Name",
          "Price (VND)",
          "Billing Cycle",
          "Max Branches",
          "Max Users",
          "Max Products",
        ],
        ...(plans || []).map((p) => [
          p.id,
          p.name || "",
          Number(p.price ?? 0),
          p.billingCycle || "MONTHLY",
          p.maxBranches ?? "",
          p.maxUsers ?? "",
          p.maxProducts ?? "",
        ]),
      ];
    } else {
      rows = [
        [
          "Store ID",
          "Brand",
          "Owner",
          "Email",
          "Phone",
          "Address",
          "Status",
          "Created At",
        ],
        ...filteredStores.map((s) => [
          s.id,
          s.brand || "",
          s.storeAdmin?.fullName || "",
          s.contact?.email || "",
          s.contact?.phone || "",
          s.contact?.address || "",
          s.status || "",
          s.createdAt || "",
        ]),
      ];
    }

    return rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  };

  const triggerCsvDownload = (typeId, fileLabel, rangeOverride = dateRange) => {
    const csvContent = buildCsvContent(typeId, rangeOverride);
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (fileLabel || typeId || "export")
      .toLowerCase()
      .replace(/\s+/g, "-");
    link.setAttribute(
      "download",
      `${safeName}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return `${Math.max(0.1, blob.size / 1024).toFixed(1)} KB`;
  };

  const handleExport = () => {
    if (!selectedType) {
      toast({
        title: "Select Export Type",
        description: "Please select an export type to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    const exportType = exportTypes.find((type) => type.id === selectedType);
    const currentRange = { ...dateRange };
    const sizeLabel = triggerCsvDownload(
      selectedType,
      exportType?.name,
      currentRange,
    );
    const nowStr = new Date().toLocaleString("sv-SE").slice(0, 16);

    setRecentExports((prev) => [
      {
        id: Date.now(),
        typeId: selectedType,
        type: exportType?.name || "Export",
        dateRange: currentRange,
        date: nowStr,
        status: "completed",
        size: sizeLabel,
        downloads: 1,
      },
      ...prev,
    ]);

    toast({
      title: "Export Completed",
      description: `${exportType?.name} has been generated and downloaded.`,
    });
    setIsExporting(false);
    setSelectedType("");
    setDateRange({ from: "", to: "" });
  };

  const handleDownload = (exportId) => {
    const target = recentExports.find((item) => item.id === exportId);
    triggerCsvDownload(
      target?.typeId || "store-list",
      target?.type || "export",
      target?.dateRange || { from: "", to: "" },
    );
    setRecentExports((prev) =>
      prev.map((item) =>
        item.id === exportId
          ? { ...item, downloads: (item.downloads || 0) + 1 }
          : item,
      ),
    );
    toast({
      title: "Download Started",
      description: `Downloading ${target?.type || "export"} CSV file.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exports</h2>
        <p className="text-muted-foreground">
          Export store data and generate reports
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Create New Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-type">Export Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select export type" />
                </SelectTrigger>
                <SelectContent>
                  {exportTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        <div>
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {type.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">From Date</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, from: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">To Date</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, to: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || !selectedType}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Export Types Info */}
        <Card>
          <CardHeader>
            <CardTitle>Available Export Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exportTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="text-muted-foreground mt-1">{type.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{type.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {type.format}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {type.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Exports (Current Session)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentExports.map((exportItem) => (
              <div
                key={exportItem.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">{exportItem.type}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {exportItem.date}
                      </span>
                      <span>{exportItem.size}</span>
                      <span>{exportItem.downloads} downloads</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      exportItem.status === "completed"
                        ? "default"
                        : "secondary"
                    }
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {exportItem.status}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(exportItem.id)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {recentExports.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No exports generated in this session yet. Select an export type
              above to generate a live CSV report.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
