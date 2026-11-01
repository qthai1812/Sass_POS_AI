import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  PlayCircle,
  Loader2,
} from "lucide-react";
import POSHeader from "./components/POSHeader";
import ProductSection from "./product/ProductSection";
import CartSection from "./cart/CartSection";
import CustomerPaymentSection from "./payment/CustomerPaymentSection";
import PaymentDialog from "./payment/PaymentDialog";
import HeldOrdersDialog from "./components/HeldOrdersDialog";
import CustomerDialog from "./customer/CustomerDialog";
import InvoiceDialog from "./order/OrderDetails/InvoiceDialog";
import { selectCartItems } from "../../Redux Toolkit/features/cart/cartSlice";
import {
  getCurrentShiftProgress,
  startShift,
} from "../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import { getStoreByEmployee } from "../../Redux Toolkit/features/store/storeThunks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SmartPosAssistantBar from "@/components/ai/SmartPosAssistantBar";

const CreateOrderPage = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();

  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showHeldOrdersDialog, setShowHeldOrdersDialog] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState("products");
  const [startingShift, setStartingShift] = useState(false);

  const searchInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const cartItems = useSelector(selectCartItems);
  const { currentShift, loading: shiftLoading } = useSelector(
    (state) => state.shiftReport,
  );
  const { store } = useSelector((state) => state.store);
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);

  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id || null;

  useEffect(() => {
    dispatch(getCurrentShiftProgress());
    if (!store?.id) {
      dispatch(getStoreByEmployee());
    }
  }, [dispatch, store?.id, userProfile?.id]);

  const handleStartShiftBanner = async () => {
    setStartingShift(true);
    try {
      await dispatch(startShift(resolvedBranchId)).unwrap();
      await dispatch(getCurrentShiftProgress());
      toast({
        title: "Ca làm việc đã bắt đầu",
        description: "Bạn đã sẵn sàng thực hiện giao dịch tại quầy POS.",
      });
    } catch (err) {
      toast({
        title: "Lỗi mở ca",
        description: typeof err === "string" ? err : "Không thể bắt đầu ca làm việc",
        variant: "destructive",
      });
    } finally {
      setStartingShift(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        setActiveMobileTab("products");
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveMobileTab("payment");
        discountInputRef.current?.focus();
      } else if (e.key === "F3" || e.key === "F4") {
        e.preventDefault();
        setShowCustomerDialog(true);
      } else if (
        e.key === "F9" ||
        (e.ctrlKey && e.key === "Enter" && cartItems.length > 0)
      ) {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowPaymentDialog(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartItems.length]);

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <POSHeader />

      {/* Thanh nhắc mở ca làm việc nếu thu ngân chưa mở ca */}
      {!shiftLoading && !currentShift && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Bạn chưa mở ca làm việc hôm nay. Vui lòng bắt đầu ca trước khi
              thanh toán đơn hàng.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleStartShiftBanner}
            disabled={startingShift}
            className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            {startingShift ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5 mr-1" />
            )}
            Bắt đầu ca ngay
          </Button>
        </div>
      )}

      {/* Smart POS Assistant Bar (AI Quick Order & Cross-sell) */}
      <SmartPosAssistantBar />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Cột 1: Danh sách sản phẩm */}
        <div
          className={`${
            activeMobileTab === "products" ? "flex" : "hidden"
          } lg:flex lg:w-[44%] xl:w-[46%] h-full overflow-hidden min-w-0`}
        >
          <ProductSection searchInputRef={searchInputRef} />
        </div>

        {/* Cột 2: Giỏ hàng */}
        <div
          className={`${
            activeMobileTab === "cart" ? "flex" : "hidden"
          } lg:flex lg:w-[32%] xl:w-[32%] h-full overflow-hidden min-w-0`}
        >
          <CartSection setShowHeldOrdersDialog={setShowHeldOrdersDialog} />
        </div>

        {/* Cột 3: Khách hàng & Thanh toán */}
        <div
          className={`${
            activeMobileTab === "payment" ? "flex" : "hidden"
          } lg:flex lg:w-[24%] xl:w-[22%] lg:min-w-[260px] h-full overflow-hidden`}
        >
          <CustomerPaymentSection
            setShowCustomerDialog={setShowCustomerDialog}
            setShowPaymentDialog={setShowPaymentDialog}
            discountInputRef={discountInputRef}
          />
        </div>
      </div>

      {/* Thanh chuyển Tab cho Mobile & Tablet (< 1024px) */}
      <div className="lg:hidden grid grid-cols-3 border-t bg-card p-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMobileTab("products")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            activeMobileTab === "products"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShoppingBag className="w-4 h-4 shrink-0" />
          <span className="truncate">Products</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("cart")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            activeMobileTab === "cart"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span className="truncate">Cart ({cartItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("payment")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
            activeMobileTab === "payment"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span className="truncate">Checkout</span>
        </button>
      </div>

      <CustomerDialog
        showCustomerDialog={showCustomerDialog}
        setShowCustomerDialog={setShowCustomerDialog}
      />

      <PaymentDialog
        showPaymentDialog={showPaymentDialog}
        setShowPaymentDialog={setShowPaymentDialog}
        setShowReceiptDialog={setShowReceiptDialog}
      />

      <InvoiceDialog
        showInvoiceDialog={showReceiptDialog}
        setShowInvoiceDialog={setShowReceiptDialog}
      />

      <HeldOrdersDialog
        showHeldOrdersDialog={showHeldOrdersDialog}
        setShowHeldOrdersDialog={setShowHeldOrdersDialog}
      />
    </div>
  );
};

export default CreateOrderPage;
