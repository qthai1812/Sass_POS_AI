import React, { useState } from "react";
import api from "@/utils/api";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ClipboardCheck } from "lucide-react";

export default function ShiftAiHandoverCard({ shiftId }) {
  const { hasFeature, loading: entLoading } = usePlanEntitlements();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  if (entLoading || !hasFeature("aiCopilot")) {
    return null;
  }

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const url = shiftId
        ? `/api/ai/shift-summary?shiftId=${shiftId}`
        : "/api/ai/shift-summary";
      const res = await api.get(url);
      setSummary(res.data);
    } catch (e) {
      console.error("Failed to generate AI shift summary:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-background">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Trợ lý AI Tóm tắt & Bàn giao ca
        </CardTitle>
        <Button size="sm" onClick={handleGenerateSummary} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Đang tổng hợp...
            </>
          ) : (
            <>
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
              Tạo nhận xét bàn giao ca
            </>
          )}
        </Button>
      </CardHeader>
      {summary && (
        <CardContent className="space-y-3 text-xs pt-2">
          <p className="p-3 rounded-lg bg-primary/10 text-foreground font-medium leading-relaxed">
            {summary.overviewParagraph}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <div className="font-bold mb-1 text-emerald-600">Tỷ trọng thanh toán</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {summary.paymentHighlights?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="font-bold mb-1 text-amber-600">Phân tích hoàn trả (Refunds)</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {summary.refundAnalysis?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <div className="font-bold mb-1 text-blue-600">Ghi chú bàn giao ca</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {summary.handoverNotes?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
