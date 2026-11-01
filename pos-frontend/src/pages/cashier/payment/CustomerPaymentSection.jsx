import DiscountSection from "./DiscountSection";
import NoteSection from "./NoteSection";
import CustomerSection from "./CustomerSection";
import PaymentSection from "./PaymentSection";

const CustomerPaymentSection = ({
  setShowCustomerDialog,
  setShowPaymentDialog,
  discountInputRef,
}) => {
  return (
    <div className="w-full flex flex-col bg-card overflow-y-auto h-full">
      {/* Customer Section */}
      <CustomerSection setShowCustomerDialog={setShowCustomerDialog} />

      {/* Discount Section */}
      <DiscountSection discountInputRef={discountInputRef} />

      {/* Note Section */}
      <NoteSection />

      {/* Payment Section */}
      <PaymentSection setShowPaymentDialog={setShowPaymentDialog} />
    </div>
  );
};

export default CustomerPaymentSection;
