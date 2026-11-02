import React, { useState } from "react";
import { useNavigate } from "react-router";
import api from "@/utils/api";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  PackagePlus,
  TicketPercent,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";

export default function AiBusinessCopilotCard({
  mode = "STORE", // "STORE" | "BRANCH"
  storeAdminId,
  storeId,
  branchId,
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasFeature, loading: entLoading } = usePlanEntitlements();

  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [creatingCouponCode, setCreatingCouponCode] = useState(null);
  const [restockingProductId, setRestockingProductId] = useState(null);

  if (!entLoading && !hasFeature("aiCopilot")) {
    return (
      <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tính năng <strong>AI Business & Inventory Copilot</strong> chưa được kích hoạt trong gói đăng ký hiện tại của cửa hàng.
            </span>
          </div>
          {mode === "STORE" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/store/upgrade")}
            >
              Nâng cấp gói cước
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const endpoint =
        mode === "BRANCH"
          ? `/api/ai/branch-insights/${branchId}`
          : `/api/ai/store-insights/${storeAdminId}`;
      const res = await api.get(endpoint);
      setInsights(res.data);
    } catch (err) {
      toast({
        title: "Không thể phân tích dữ liệu",
        description: err.response?.data?.message || "Vui lòng kiểm tra gói cước hoặc thử lại sau.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateCoupon = async (suggestion) => {
    if (!storeId) {
      toast({
        title: "Thiếu Store ID",
        description: "Không tìm thấy mã cửa hàng để tạo coupon.",
        variant: "destructive",
      });
      return;
    }
    setCreatingCouponCode(suggestion.suggestedCode);
    try {
      await api.post("/api/coupons", {
        code: suggestion.suggestedCode,
        discountType: suggestion.discountType,
        discountValue: suggestion.discountValue,
        minOrderValue: suggestion.minOrderValue,
        isActive: true,
        storeId,
      });
      toast({
        title: "Đã tạo mã giảm giá thành công!",
        description: `Mã ${suggestion.suggestedCode} (-${suggestion.discountValue}%) đã sẵn sàng áp dụng tại POS.`,
      });
    } catch (err) {
      toast({
        title: "Không thể tạo mã",
        description: err.response?.data?.message || "Mã giảm giá đã tồn tại.",
        variant: "destructive",
      });
    } finally {
      setCreatingCouponCode(null);
    }
  };

  const handleQuickRestock = async (item) => {
    const targetBranchId = item.branchId || branchId;
    if (!targetBranchId) {
      toast({
        title: "Chọn chi nhánh",
        description: "Vui lòng vào trang Quản lý chi nhánh cụ thể để nhập kho 1-click.",
      });
      return;
    }
    setRestockingProductId(item.productId);
    try {
      await api.post("/api/inventories", {
        branchId: targetBranchId,
        productId: item.productId,
        quantity: item.suggestedRestockQty,
      });
      toast({
        title: "Đã nhập bổ sung tồn kho!",
        description: `Đã cộng thêm +${item.suggestedRestockQty} SP cho "${item.productName}".`,
      });
      handleAnalyze();
    } catch (err) {
      toast({
        title: "Lỗi nhập kho",
        description: err.response?.data?.message || "Không thể cập nhật tồn kho.",
        variant: "destructive",
      });
    } finally {
      setRestockingProductId(null);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Business & Inventory Copilot
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Phân tích nguyên nhân tăng/giảm doanh thu, cảnh báo hoàn trả bất thường, dự báo nhập hàng & gợi ý mã khuyến mãi
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang phân tích...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {insights ? "Phân tích lại bằng AI" : "Phân tích bằng AI"}
            </>
          )}
        </Button>
      </CardHeader>

      {insights && (
        <CardContent className="space-y-5 pt-2">
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-sm font-medium leading-relaxed">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Tổng quan điều hành ({insights.targetName})
              </span>
              <Badge variant="outline" className="text-[10px]">
                {insights.generatedBy}
              </Badge>
            </div>
            {insights.executiveSummary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
                Phân tích Doanh thu & Hiệu suất
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                {insights.revenueDrivers?.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Cảnh báo Rủi ro & Hoàn trả (Refunds)
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                {insights.riskAlerts?.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {insights.restockSuggestions?.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4 text-blue-600" />
                Dự báo Nhập hàng thông minh (Smart Restock)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.restockSuggestions.map((item) => (
                  <div
                    key={`${item.branchId}-${item.productId}`}
                    className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {item.productName}
                        <Badge
                          variant={item.urgency === "HIGH" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          Tồn: {item.currentStock}
                        </Badge>
                      </div>
                      {mode === "STORE" && item.branchName && (
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Chi nhánh: {item.branchName}
                        </p>
                      )}
                      <p className="text-muted-foreground">{item.reason}</p>
                      <p className="font-semibold text-blue-600">
                        Đề xuất nhập thêm: +{item.suggestedRestockQty} SP
                      </p>
                    </div>
                    {(branchId || item.branchId) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restockingProductId === item.productId}
                        onClick={() => handleQuickRestock(item)}
                      >
                        {restockingProductId === item.productId
                          ? "Đang nhập..."
                          : `+${item.suggestedRestockQty} Kho`}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.couponSuggestions?.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-sm font-bold flex items-center gap-1.5">
                <TicketPercent className="w-4 h-4 text-purple-600" />
                Gợi ý Khuyến mãi xả hàng / Kích cầu (Smart Coupon)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {insights.couponSuggestions.map((cp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-card flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge className="font-mono">{cp.suggestedCode}</Badge>
                        <span className="font-bold text-purple-600">
                          Giảm {cp.discountValue}%
                        </span>
                      </div>
                      <div className="font-medium text-foreground">
                        {cp.targetProductOrCategory}
                      </div>
                      <p className="text-muted-foreground">{cp.reason}</p>
                    </div>
                    {storeId && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full mt-1"
                        disabled={creatingCouponCode === cp.suggestedCode}
                        onClick={() => handleQuickCreateCoupon(cp)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {creatingCouponCode === cp.suggestedCode
                          ? "Đang tạo..."
                          : `Tạo mã ${cp.suggestedCode}`}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
