import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import OrderDetails from "./OrderDetails";
import {
  resetOrder,
  selectCurrentOrder,
} from "../../../../Redux Toolkit/features/cart/cartSlice";
import { handleDownloadOrderPDF } from "../pdf/pdfUtils";

const InvoiceDialog = ({ showInvoiceDialog, setShowInvoiceDialog }) => {
  let selectedOrder = useSelector(selectCurrentOrder);
  const { toast } = useToast();
  const dispatch = useDispatch();

  const handlePrintInvoice = () => {
    toast({
      title: "Printing Invoice",
      description: `Preparing print view for Invoice #${selectedOrder?.id || ""}`,
    });
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleDownloadPDF = async () => {
    await handleDownloadOrderPDF(selectedOrder, toast);
  };

  const finishOrder = () => {
    setShowInvoiceDialog(false);
    dispatch(resetOrder());

    toast({
      title: "Order Completed",
      description: "Receipt printed and order saved successfully",
    });
  };

  return (
    <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
      {selectedOrder && (
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Order Details - Invoice #{selectedOrder.id}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <OrderDetails selectedOrder={selectedOrder} />
          </div>

          <DialogFooter className="gap-2 sm:justify-between pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={handlePrintInvoice}>
                <Printer className="w-4 h-4 mr-2" />
                Print Invoice
              </Button>
            </div>

            <Button onClick={finishOrder}>Start New Order</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default InvoiceDialog;
