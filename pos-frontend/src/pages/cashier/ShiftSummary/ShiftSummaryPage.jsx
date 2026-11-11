import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShiftInformationCard,
  SalesSummaryCard,
  PaymentSummaryCard,
  TopSellingItemsCard,
  RecentOrdersCard,
  RefundsCard,
  ShiftHeader,
  LogoutConfirmDialog,
  PrintDialog
} from './components';
import {
  getCurrentShiftProgress,
  startShift,
  endShift,
} from '../../../Redux Toolkit/features/shiftReport/shiftReportThunks';
import { logout } from '../../../Redux Toolkit/features/user/userThunks';
import { useNavigate } from 'react-router';
import ShiftAiHandoverCard from "@/components/ai/ShiftAiHandoverCard";

const ShiftSummaryPage = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const [showLogoutConfirmDialog, setShowLogoutConfirmDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const navigate = useNavigate();

  const { currentShift, loading } = useSelector((state) => state.shiftReport);
  const { branch } = useSelector((state) => state.branch);
  const { store } = useSelector((state) => state.store);
  const { userProfile } = useSelector((state) => state.user);
  const printTimeoutRef = useRef(null);

  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id || null;

  useEffect(() => {
    dispatch(getCurrentShiftProgress());
    return () => {
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
      }
    };
  }, [dispatch]);

  const handleStartShift = async () => {
    try {
      await dispatch(startShift(resolvedBranchId)).unwrap();
      dispatch(getCurrentShiftProgress());
      toast({
        title: 'Shift Started',
        description: 'Shift started successfully',
      });
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Failed to start shift';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const handlePrintSummary = () => {
    setShowPrintDialog(false);
    if (!currentShift) {
      toast({
        title: 'No Active Shift',
        description: 'Start a shift before printing the shift summary.',
        variant: 'destructive',
      });
      return;
    }
    if (printTimeoutRef.current) {
      clearTimeout(printTimeoutRef.current);
    }
    // Wait for Radix Dialog's 200ms close transition and unmount before opening OS print preview
    printTimeoutRef.current = setTimeout(() => {
      window.print();
    }, 350);
  };

  const handleEndShift = async () => {
    setShowLogoutConfirmDialog(false);
    try {
      await dispatch(endShift()).unwrap();
      await dispatch(logout());
      navigate('/');
      toast({
        title: 'Shift Ended',
        description: 'You have been logged out successfully',
      });
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Không thể đóng ca làm việc. Vui lòng kiểm tra kết nối mạng và thử lại.';
      toast({
        title: 'Lỗi kết thúc ca làm việc',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const reportBranch = currentShift?.branch || branch;
  const reportStoreName = store?.brand || reportBranch?.name || 'POS Pro';
  const reportAddress = reportBranch?.address || store?.contact?.address || '';
  const reportPhone = reportBranch?.phone || store?.contact?.phone || '';

  return (
    <div className="h-full flex flex-col print-scroll-reset">
      <ShiftHeader 
        hasActiveShift={Boolean(currentShift)}
        onPrintClick={() => {
          if (!currentShift) {
            toast({
              title: 'No Active Shift',
              description: 'You need an active shift to print a summary report.',
              variant: 'destructive',
            });
            return;
          }
          setShowPrintDialog(true);
        }}
        onEndShiftClick={() => setShowLogoutConfirmDialog(true)}
      />
      <div className="flex-1 overflow-auto p-4 print-scroll-reset print:p-0">
        {loading ? (
          <div className="flex justify-center items-center h-full text-lg">Loading shift summary...</div>
        ) : currentShift ? (
          <>
            <div className="hidden print:block mb-4 pb-3 border-b-2 border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wide">{reportStoreName}</h1>
                  {reportBranch?.name && reportBranch.name !== reportStoreName && (
                    <p className="text-sm font-medium">{reportBranch.name}</p>
                  )}
                  {reportAddress && <p className="text-xs text-gray-600">{reportAddress}</p>}
                  {reportPhone && <p className="text-xs text-gray-600">Tel: {reportPhone}</p>}
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold uppercase">Shift Summary Report</h2>
                  <p className="text-xs text-gray-600">Shift #{currentShift.id}</p>
                </div>
              </div>
            </div>
            <div className="mb-6 print:mb-4">
              <ShiftAiHandoverCard shiftId={currentShift?.id} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 mb-6 print:gap-3 print:mb-4 break-inside-avoid">
              <ShiftInformationCard shiftData={currentShift} />
              <SalesSummaryCard shiftData={currentShift} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 mb-6 print:gap-3 print:mb-4 break-inside-avoid">
              <PaymentSummaryCard shiftData={currentShift} />
              <TopSellingItemsCard shiftData={currentShift} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 print:gap-3">
              <RecentOrdersCard shiftData={currentShift} />
              <RefundsCard shiftData={currentShift} />
            </div>
          </>
        ) : (
          <div className="flex justify-center items-center h-full">
            <Card className="max-w-md w-full">
              <CardContent className="p-6 text-center space-y-4">
                <h2 className="text-xl font-semibold">No Active Shift</h2>
                <p className="text-muted-foreground">
                  You don&apos;t have an active shift right now. Start a shift to track your sales, orders, and refunds.
                </p>
                <Button onClick={handleStartShift} className="w-full">
                  Start Shift
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <LogoutConfirmDialog 
        isOpen={showLogoutConfirmDialog}
        onClose={() => setShowLogoutConfirmDialog(false)}
        onConfirm={handleEndShift}
      />
      <PrintDialog 
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        onConfirm={handlePrintSummary}
      />
    </div>
  );
};

export default ShiftSummaryPage;
