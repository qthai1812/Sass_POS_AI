import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useToast } from '@/components/ui/use-toast';
import { toast as sonnerToast } from 'sonner';
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
  const { userProfile } = useSelector((state) => state.user);

  const resolvedBranchId =
    branch?.id || userProfile?.branchId || userProfile?.branch?.id || null;

  useEffect(() => {
    dispatch(getCurrentShiftProgress());
  }, [dispatch]);

  const handleStartShift = async () => {
    try {
      await dispatch(startShift(resolvedBranchId)).unwrap();
      dispatch(getCurrentShiftProgress());
      sonnerToast.success('Shift started successfully');
      toast({
        title: 'Shift Started',
        description: 'Shift started successfully',
      });
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Failed to start shift';
      sonnerToast.error(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const handlePrintSummary = () => {
    setShowPrintDialog(false);
    toast({
      title: 'Printing Shift Summary',
      description: 'Shift summary is being printed',
    });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleEndShift = async () => {
    setShowLogoutConfirmDialog(false);
    try {
      await dispatch(endShift()).unwrap();
    } catch {
      // Proceed with logout even if shift end fails
    }
    await dispatch(logout());
    navigate('/');
    toast({
      title: 'Shift Ended',
      description: 'You have been logged out successfully',
    });
  };

  return (
    <div className="h-full flex flex-col">
      <ShiftHeader 
        onPrintClick={() => setShowPrintDialog(true)}
        onEndShiftClick={() => setShowLogoutConfirmDialog(true)}
      />
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full text-lg">Loading shift summary...</div>
        ) : currentShift ? (
          <>
            <div className="mb-6">
              <ShiftAiHandoverCard shiftId={currentShift?.id} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <ShiftInformationCard shiftData={currentShift} />
              <SalesSummaryCard shiftData={currentShift} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <PaymentSummaryCard shiftData={currentShift} />
              <TopSellingItemsCard shiftData={currentShift} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
