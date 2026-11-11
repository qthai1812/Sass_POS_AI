import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSidebar } from "../../../context/hooks/useSidebar";
import {
  startShift,
  getCurrentShiftProgress,
} from "../../../Redux Toolkit/features/shiftReport/shiftReportThunks";
import { PlayCircle, CheckCircle2, Loader2 } from "lucide-react";
import UserProfileMenu from "@/components/account/UserProfileMenu";

const POSHeader = () => {
  const { setSidebarOpen } = useSidebar();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentShift } = useSelector((state) => state.shiftReport);
  const { branch } = useSelector((state) => state.branch);
  const { userProfile } = useSelector((state) => state.user);
  const [startingShift, setStartingShift] = useState(false);

  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id || null;

  const handleQuickStartShift = async () => {
    setStartingShift(true);
    try {
      await dispatch(startShift(resolvedBranchId)).unwrap();
      await dispatch(getCurrentShiftProgress());
      toast({
        title: "Đã mở ca làm việc",
        description: "Ca làm việc mới đã bắt đầu. Bạn có thể tạo đơn hàng ngay!",
      });
    } catch (err) {
      toast({
        title: "Không thể mở ca",
        description: typeof err === "string" ? err : "Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setStartingShift(false);
    }
  };

  return (
    <div className="bg-background/95 backdrop-blur border-b border-border px-4 md:px-6 py-3 shadow-sm">
      <div className="grid grid-cols-12 items-center w-full gap-2">
        {/* 1. CỘT TRÁI (3/12): Nút mở Menu Sidebar + Trạng thái Ca */}
        <div className="col-span-4 md:col-span-3 flex items-center justify-start gap-2.5">
          <Button
            variant="outline"
            className="z-10 p-2 h-10 w-10 rounded-lg shadow-sm border-border hover:bg-muted shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>

          {currentShift ? (
            <button
              type="button"
              onClick={() => navigate("/cashier/shift-summary")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
              title="Xem chi tiết ca làm việc hiện tại"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Ca #{currentShift.id} đang mở</span>
            </button>
          ) : (
            <Button
              size="sm"
              onClick={handleQuickStartShift}
              disabled={startingShift}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold h-9 px-3 shadow-xs"
            >
              {startingShift ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
              )}
              Mở ca làm việc
            </Button>
          )}
        </div>

        {/* 2. CỘT GIỮA: POS TERMINAL NỔI BẬT & CĂN GIỮA */}
        <div className="col-span-6 md:col-span-5 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 px-4 md:px-5 py-1.5 rounded-full shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>

            <h1 className="text-base md:text-2xl font-black tracking-widest bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent uppercase">
              POS Terminal
            </h1>
          </div>
          <p className="text-[10px] md:text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mt-1 hidden sm:block">
            Hệ Thống Bán Hàng Tại Quầy • Điểm Thu Ngân
          </p>
        </div>

        {/* 3. CỘT PHẢI: Khu vực phím tắt + Tài khoản đăng nhập */}
        <div className="col-span-2 md:col-span-4 flex items-center justify-end gap-2.5">
          <Badge
            variant="outline"
            className="hidden xl:inline-flex py-1.5 px-3 bg-muted/30 shadow-sm font-medium"
          >
            <span className="font-mono font-bold text-foreground mr-1">
              F1:
            </span>{" "}
            Tìm kiếm
            <span className="text-border mx-1.5">|</span>
            <span className="font-mono font-bold text-foreground mr-1">
              F2:
            </span>{" "}
            KM
            <span className="text-border mx-1.5">|</span>
            <span className="font-mono font-bold text-foreground mr-1">
              Ctrl+Enter:
            </span>{" "}
            Thanh toán
          </Badge>
          <UserProfileMenu />
        </div>
      </div>
    </div>
  );
};

export default POSHeader;
