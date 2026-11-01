import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  Store,
  Users,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useToast } from "@/components/ui/use-toast";

const PricingCalculator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [storeCount, setStoreCount] = useState(1);
  const [employeeCount, setEmployeeCount] = useState(5);
  const [transactionVolume, setTransactionVolume] = useState("medium");
  const [totalPrice, setTotalPrice] = useState(0);
  const [savings, setSavings] = useState(0);

  useEffect(() => {
    const basePrice = 999;
    let storeMultiplier = storeCount;
    if (storeCount > 5) storeMultiplier = storeCount * 0.9;
    if (storeCount > 10) storeMultiplier = storeCount * 0.8;

    const employeeFactor = Math.min(1 + (employeeCount - 5) * 0.02, 1.5);
    const volumeFactors = {
      low: 0.8,
      medium: 1.0,
      high: 1.2,
      enterprise: 1.5,
    };

    const rawPrice =
      basePrice *
      storeMultiplier *
      employeeFactor *
      volumeFactors[transactionVolume];
    const noDiscountPrice =
      basePrice *
      storeCount *
      employeeFactor *
      volumeFactors[transactionVolume];
    const calculatedSavings = noDiscountPrice - rawPrice;
    const roundedPrice = Math.ceil(rawPrice / 100) * 100 - 1;

    setTotalPrice(roundedPrice);
    setSavings(Math.round(calculatedSavings));
  }, [storeCount, employeeCount, transactionVolume]);

  const handleGetQuote = () => {
    toast({
      title: "Custom Estimate Saved",
      description: `Estimated plan: đ${totalPrice.toLocaleString()}/month for ${storeCount} store(s) & ${employeeCount} employees.`,
    });
    const contactEl = document.getElementById("contact");
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/auth/onboarding");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="dark:bg-[#303030] rounded-2xl shadow-xl overflow-hidden border">
        <div className="bg-primary/10 p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Calculator className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-foreground">
              Pricing Calculator
            </h3>
          </div>
          <p className="text-muted-foreground">
            Estimate your monthly subscription based on your business needs
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground flex items-center">
                <Store className="w-4 h-4 mr-2" /> Number of Stores
              </label>
              <span className="bg-primary/10 text-primary text-sm font-medium px-2 py-1 rounded">
                {storeCount} {storeCount === 1 ? "store" : "stores"}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={storeCount}
              onChange={(e) => setStoreCount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20+</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground flex items-center">
                <Users className="w-4 h-4 mr-2" /> Number of Employees
              </label>
              <span className="bg-primary/10 text-primary text-sm font-medium px-2 py-1 rounded">
                {employeeCount} {employeeCount === 1 ? "employee" : "employees"}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span>
              <span>10</span>
              <span>25</span>
              <span>40</span>
              <span>50+</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground flex items-center mb-2">
              <ShoppingCart className="w-4 h-4 mr-2" /> Transaction Volume
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "enterprise", label: "Enterprise" },
              ].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    transactionVolume === option.value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => setTransactionVolume(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dark:text-white rounded-xl p-6 mt-6 bg-muted/40">
            <div className="flex justify-between items-center mb-4">
              <span className="text-foreground">Estimated Monthly Price:</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  đ{totalPrice.toLocaleString()}
                </div>
                {savings > 0 && (
                  <div className="text-sm text-green-600">
                    You save đ{savings.toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground mb-6">
              Price includes all features, unlimited transactions, and 24/7
              support. Annual billing available with 2 months free.
            </div>

            <Button onClick={handleGetQuote} className="w-full group">
              Get Custom Quote
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingCalculator;
