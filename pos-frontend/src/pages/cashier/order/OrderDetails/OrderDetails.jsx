import OrderInformation from "./OrderInformation";
import CustomerInformation from "./CustomerInformation";
import OrderItemTable from "../../../common/Order/OrderItemTable";
import { Card, CardContent } from "../../../../components/ui/card";

const OrderDetails = ({ selectedOrder, printerSettings }) => {
  const printCustomerDetails = printerSettings?.printCustomerDetails !== false;
  const printItemizedTax = printerSettings?.printItemizedTax !== false;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-1 gap-4 mb-4">
        <OrderInformation
          selectedOrder={selectedOrder}
          printItemizedTax={printItemizedTax}
        />
        <div className={printCustomerDetails ? "" : "no-print"}>
          <CustomerInformation selectedOrder={selectedOrder} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-2">Order Items</h3>
          <OrderItemTable selectedOrder={selectedOrder} />
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetails;
