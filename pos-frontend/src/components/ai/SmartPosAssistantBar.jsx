import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "@/utils/api";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";
import {
  addToCart,
  setSelectedCustomer,
  setCouponCode,
  setDiscount,
  setPaymentMethod,
  setNote,
  selectCartItems,
  selectSelectedCustomer,
} from "@/Redux Toolkit/features/cart/cartSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, Mic, MicOff, Send, PlusCircle, Loader2 } from "lucide-react";

export default function SmartPosAssistantBar() {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { hasFeature, loading: entLoading } = usePlanEntitlements();

  const cartItems = useSelector(selectCartItems);
  const selectedCustomer = useSelector(selectSelectedCustomer);
  const { userProfile } = useSelector((state) => state.user);
  const { store } = useSelector((state) => state.store);

  const branchId = userProfile?.branchId;
  const storeId = store?.id || userProfile?.storeId;

  const [command, setCommand] = useState("");
  const [parsing, setParsing] = useState(false);
  const [listening, setListening] = useState(false);
  const [crossSellList, setCrossSellList] = useState([]);

  const aiEnabled = !entLoading && hasFeature("aiCopilot");

  useEffect(() => {
    if (!aiEnabled || (!branchId && !storeId)) return;
    const cartProductIds = cartItems.map((i) => i.id);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (branchId) params.append("branchId", branchId);
        if (storeId) params.append("storeId", storeId);
        if (selectedCustomer?.id) params.append("customerId", selectedCustomer.id);

        const res = await api.post(
          `/api/ai/pos/cross-sell?${params.toString()}`,
          cartProductIds
        );
        setCrossSellList(res.data || []);
      } catch {
        // Bỏ qua lỗi ngầm
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [aiEnabled, cartItems, selectedCustomer?.id, branchId, storeId]);

  if (!aiEnabled) {
    return null;
  }

  const handleExecuteCommand = async (e) => {
    e?.preventDefault();
    if (!command.trim()) return;
    setParsing(true);
    try {
      const res = await api.post("/api/ai/pos/quick-command", {
        storeId,
        branchId,
        command: command.trim(),
      });
      const data = res.data;

      if (data.matchedItems?.length > 0) {
        data.matchedItems.forEach((item) => {
          dispatch(
            addToCart({ ...item.product, quantityToAdd: item.quantity })
          );
        });
      }

      if (data.matchedCustomer) {
        dispatch(setSelectedCustomer(data.matchedCustomer));
      }

      if (data.appliedCoupon) {
        const cp = data.appliedCoupon;
        dispatch(setCouponCode(cp.code));
        dispatch(
          setDiscount({
            type: cp.discountType?.toLowerCase() === "percentage" ? "percentage" : "fixed",
            value: cp.discountValue,
            minOrderValue: cp.minOrderValue,
          })
        );
      }

      if (data.paymentMethod) {
        dispatch(setPaymentMethod(data.paymentMethod));
      }

      if (data.note) {
        dispatch(setNote(data.note));
      }

      toast({
        title: "AI Quick Order hoàn tất",
        description: data.summaryMessage,
      });
      setCommand("");
    } catch (err) {
      toast({
        title: "Không thể phân tích câu lệnh",
        description: err.response?.data?.message || "Vui lòng kiểm tra lại câu lệnh.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Trình duyệt không hỗ trợ",
        description: "Vui lòng dùng Google Chrome hoặc Edge để nhận diện giọng nói.",
        variant: "destructive",
      });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
    };
    recognition.start();
  };

  return (
    <div className="p-3 border-b bg-gradient-to-r from-primary/10 via-background to-primary/5 space-y-2.5">
      <form onSubmit={handleExecuteCommand} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder='Lên đơn nhanh: "Lấy 2 sản phẩm X, 1 sản phẩm Y cho khách 098xxx, áp mã SALE10"...'
            className="pl-9 pr-10 h-9 text-xs bg-background"
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            title="Nhập bằng giọng nói"
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${
              listening ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:text-primary"
            }`}
          >
            {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button type="submit" size="sm" disabled={parsing || !command.trim()} className="h-9 text-xs">
          {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
          Lên đơn AI
        </Button>
      </form>

      {crossSellList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold text-primary shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Gợi ý mua kèm:
          </span>
          {crossSellList.map((item) => (
            <div
              key={item.product?.id}
              onClick={() => dispatch(addToCart(item.product))}
              title={item.reason}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-card hover:border-primary cursor-pointer transition-colors shrink-0 text-xs"
            >
              <span className="font-medium truncate max-w-[140px]">
                {item.product?.name}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {Number(item.product?.sellingPrice || 0).toLocaleString("vi-VN")}đ
              </Badge>
              <PlusCircle className="w-3.5 h-3.5 text-primary" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
