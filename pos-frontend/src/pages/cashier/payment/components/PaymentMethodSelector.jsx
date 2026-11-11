import React from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";

const METHOD_ICONS = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
};

const PaymentMethodSelector = ({
  methods,
  selectedMethod,
  onSelectMethod,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold block">
        Chọn phương thức thanh toán
      </label>
      <div className="grid grid-cols-3 gap-2">
        {methods.map((method) => {
          const Icon = METHOD_ICONS[method.id] || CreditCard;
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelectMethod(method.id)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                isSelected
                  ? `${method.activeClass} ring-2 ring-current font-semibold shadow-xs`
                  : "hover:bg-muted/60 border-border text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs leading-tight">{method.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentMethodSelector;
