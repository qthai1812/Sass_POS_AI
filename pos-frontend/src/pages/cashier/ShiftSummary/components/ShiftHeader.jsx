import React from "react";
import { Button } from "@/components/ui/button";
import { PrinterIcon, ArrowRightIcon } from "lucide-react";
import { useSidebar } from "../../../../context/hooks/useSidebar";
import UserProfileMenu from "@/components/account/UserProfileMenu";

const ShiftHeader = ({ onPrintClick, onEndShiftClick, hasActiveShift = true }) => {
  const { setSidebarOpen } = useSidebar();

  return (
    <div className="p-4 bg-card border-b no-print">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
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
          <h1 className="text-2xl font-bold">Shift Summary</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={onPrintClick} disabled={!hasActiveShift}>
            <PrinterIcon className="h-4 w-4 mr-2" />
            Print Summary
          </Button>
          <Button variant="destructive" onClick={onEndShiftClick}>
            <ArrowRightIcon className="h-4 w-4 mr-2" />
            End Shift & Logout
          </Button>
          <UserProfileMenu />
        </div>
      </div>
    </div>
  );
};

export default ShiftHeader;
