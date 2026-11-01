import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Download,
  FileText,
  BarChart2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart as RPieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  getDailySalesChart,
  getPaymentBreakdown,
  getCategoryWiseSalesBreakdown,
  getTopCashiersByRevenue,
} from "@/Redux Toolkit/features/branchAnalytics/branchAnalyticsThunks";
import { useToast } from "@/components/ui/use-toast";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const Reports = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const branchId = useSelector((state) => state.branch.branch?.id);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { dailySales, paymentBreakdown, categorySales, topCashiers } =
    useSelector((state) => state.branchAnalytics);

  useEffect(() => {
    if (branchId) {
      dispatch(getDailySalesChart({ branchId }));
      dispatch(getPaymentBreakdown({ branchId, date: selectedDate }));
      dispatch(getCategoryWiseSalesBreakdown({ branchId, date: selectedDate }));
      dispatch(getTopCashiersByRevenue(branchId));
    }
  }, [branchId, selectedDate, dispatch]);

  const salesData =
    dailySales?.map((item) => ({
      date: item.date,
      sales: item.totalSales,
    })) || [];

  const paymentData =
    paymentBreakdown?.map((item) => ({
      name: item.paymentType,
      value: item.percentage,
    })) || [];

  const paymentConfig =
    paymentBreakdown?.reduce((acc, item, idx) => {
      acc[item.paymentType] = {
        label: item.paymentType,
        color: COLORS[idx % COLORS.length],
      };
      return acc;
    }, {}) || {};

  const categoryData =
    categorySales?.map((item) => ({
      name: item.categoryName,
      value: item.totalRevenue,
    })) || [];

  const categoryConfig =
    categorySales?.reduce((acc, item, idx) => {
      acc[item.categoryName] = {
        label: item.categoryName,
        color: COLORS[idx % COLORS.length],
      };
      return acc;
    }, {}) || {};

  const cashierData =
    topCashiers?.map((item) => ({
      name: item.cashierName,
      sales: item.totalRevenue,
    })) || [];

  const cashierConfig = {
    sales: { label: "Sales", color: "#4f46e5" },
  };

  const salesConfig = {
    sales: { label: "Sales", color: "#4f46e5" },
  };

  const formatCurrency = (amount) => {
    return `đ${Number(amount || 0).toLocaleString("vi-VN")}`;
  };

  const handleExport = (type) => {
    let headers = "";
    let rows = [];

    if (type === "sales") {
      headers = "Date,Total Sales";
      rows = salesData.map((d) => `${d.date},${d.sales}`);
    } else if (type === "payments") {
      headers = "Payment Method,Percentage";
      rows = paymentData.map((d) => `"${d.name}",${d.value}%`);
    } else if (type === "products") {
      headers = "Category,Total Revenue";
      rows = categoryData.map((d) => `"${d.name}",${d.value}`);
    } else if (type === "cashier") {
      headers = "Cashier Name,Total Sales";
      rows = cashierData.map((d) => `"${d.name}",${d.sales}`);
    } else {
      headers = "Report Section,Metric,Value";
      rows = [
        ...salesData.map((d) => `Daily Sales,${d.date},${d.sales}`),
        ...paymentData.map((d) => `Payment Method,"${d.name}",${d.value}%`),
        ...categoryData.map((d) => `Category Revenue,"${d.name}",${d.value}`),
        ...cashierData.map((d) => `Cashier Performance,"${d.name}",${d.sales}`),
      ];
    }

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `branch_${branchId || 1}_${type}_report_${selectedDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: `Downloaded ${type.toUpperCase()} report for ${selectedDate}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Reports & Analytics
        </h1>
        <div className="flex items-center gap-2">
          {showDatePicker && (
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40 h-9"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDatePicker((prev) => !prev)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            {selectedDate === new Date().toISOString().slice(0, 10)
              ? "Today"
              : selectedDate}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("all")}
          >
            <Download className="h-4 w-4 mr-1" />
            Export All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="cashier" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Cashier Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Daily Sales Trend</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleExport("sales")}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={salesConfig}>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={salesData}>
                      <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `đ${v}`}
                      />
                      <ChartTooltip
                        content={({ active, payload }) => (
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                            formatter={(v) => [`đ${v}`, "Sales"]}
                          />
                        )}
                      />
                      <Bar
                        dataKey="sales"
                        fill="currentColor"
                        radius={[4, 4, 0, 0]}
                        className="fill-primary"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Payment Methods</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleExport("payments")}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={paymentConfig}>
                  <ResponsiveContainer width="100%" height={360}>
                    <RPieChart>
                      <Pie
                        data={paymentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ active, payload }) => (
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                            formatter={(v) => [`${v}%`, "Percentage"]}
                          />
                        )}
                      />
                      <ChartLegend
                        content={({ payload }) => (
                          <ChartLegendContent payload={payload} />
                        )}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Sales Performance</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleExport("sales")}
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={salesConfig}>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={salesData}>
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `đ${v}`}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                          formatter={(v) => [`đ${v}`, "Sales"]}
                        />
                      )}
                    />
                    <Bar
                      dataKey="sales"
                      fill="currentColor"
                      radius={[4, 4, 0, 0]}
                      className="fill-primary"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Product Category Performance</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleExport("products")}
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartContainer config={categoryConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <RPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ active, payload }) => (
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                          />
                        )}
                      />
                      <ChartLegend
                        content={({ payload }) => (
                          <ChartLegendContent payload={payload} />
                        )}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <div className="space-y-4">
                  {categoryData.map((category, index) => (
                    <div key={index} className="rounded-lg bg-muted/50 p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {category.name}
                          </p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(category.value)}
                          </p>
                        </div>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashier">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Cashier Performance</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleExport("cashier")}
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={cashierConfig}>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart
                    data={cashierData}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `đ${v}`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => (
                        <ChartTooltipContent
                          active={active}
                          payload={payload}
                        />
                      )}
                    />
                    <Bar
                      dataKey="sales"
                      fill="currentColor"
                      radius={[0, 4, 4, 0]}
                      className="fill-primary"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
