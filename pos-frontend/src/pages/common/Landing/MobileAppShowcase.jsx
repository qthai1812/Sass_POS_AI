import React from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const MobileAppShowcase = () => {
  const { toast } = useToast();

  const appFeatures = [
    "Real-time sales tracking",
    "Inventory management on the go",
    "Push notifications for low stock",
    "Mobile receipt generation",
    "Customer management",
    "Offline functionality",
  ];

  const handleAppDownload = (platform) => {
    toast({
      title: `POS Pro for ${platform}`,
      description: `The ${platform} app installer link has been sent. You can also scan the QR code on screen.`,
    });
  };

  return (
    <section
      id="mobile-app"
      className="py-16 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary rounded-full px-4 py-1 text-sm font-medium mb-6">
              <Smartphone className="w-4 h-4" />
              <span>Mobile App</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Take Your Business <span className="text-primary">Anywhere</span>{" "}
              With Our Mobile App
            </h2>

            <p className="text-lg text-gray-600 mb-8">
              Our mobile app gives you the freedom to manage your business from
              anywhere. Check sales, update inventory, and stay connected with
              your team—all from your smartphone.
            </p>

            <div className="space-y-4 mb-8">
              {appFeatures.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="group"
                onClick={() => handleAppDownload("iOS")}
              >
                Download for iOS
                <Download className="ml-2 w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="group"
                onClick={() => handleAppDownload("Android")}
              >
                Download for Android
                <Download className="ml-2 w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              </Button>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="w-[280px] h-[520px] bg-gray-900 rounded-[40px] p-3 shadow-2xl relative z-10 overflow-hidden">
              <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative p-4 pt-10">
                <div className="bg-primary text-white p-4 rounded-xl mb-4">
                  <h3 className="font-bold">POS Pro Mobile</h3>
                  <p className="text-xs opacity-80">Live Store Dashboard</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Today's Sales</p>
                    <p className="text-lg font-bold text-gray-900">đ12,450</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Orders</p>
                    <p className="text-lg font-bold text-gray-900">48</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileAppShowcase;
