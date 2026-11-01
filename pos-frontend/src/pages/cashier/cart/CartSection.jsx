import { Button } from "@/components/ui/button";
import { ShoppingCart, Pause, Trash2 } from "lucide-react";
import CartItem from "./CartItem";
import CartSummary from "./CartSummary";
import { useSelector, useDispatch } from "react-redux";
import {
  clearCart,
  removeFromCart,
  selectCartItems,
  selectHeldOrders,
  updateCartItemQuantity,
} from "../../../Redux Toolkit/features/cart/cartSlice";
import { useToast } from "../../../components/ui/use-toast";
import usePlanEntitlements from "@/hooks/usePlanEntitlements";

const CartSection = ({ setShowHeldOrdersDialog }) => {
  const cartItems = useSelector(selectCartItems);
  const heldOrders = useSelector(selectHeldOrders);
  const { inventories = [] } = useSelector((state) => state.inventory || {});
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { hasFeature } = usePlanEntitlements();
  const trackStock = hasFeature("inventory");

  const handleUpdateCartItemQuantity = (id, newQuantity) => {
    if (newQuantity > 0 && trackStock) {
      const inv = (inventories || []).find(
        (i) => (i.productId ?? i.product?.id) === id,
      );
      const maxAvailable = inv ? Number(inv.quantity ?? 0) : 0;
      if (maxAvailable > 0 && newQuantity > maxAvailable) {
        toast({
          title: "Vượt quá tồn kho",
          description: `Chi nhánh hiện chỉ còn tối đa ${maxAvailable} sản phẩm này trong kho.`,
          variant: "destructive",
        });
        return;
      }
    }
    dispatch(updateCartItemQuantity({ id, quantity: newQuantity }));
  };

  const handleRemoveFromCart = (id) => {
    dispatch(removeFromCart(id));
  };

  const handleClearCart = () => {
    dispatch(clearCart());
    toast({
      title: "Cart Cleared",
      description: "All items removed from cart",
    });
  };

  return (
    <div className="w-full flex flex-col bg-card border-r h-full">
      <div className="p-4 border-b bg-muted">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2" />
            Cart ({cartItems.length} items)
          </h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHeldOrdersDialog(true)}
            >
              <Pause className="w-4 h-4 mr-1" />
              Held ({heldOrders.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCart}
              disabled={cartItems.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Cart is empty</p>
            <p className="text-sm">Add products to start an order</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {cartItems.map((item) => (
              <CartItem
                item={item}
                key={item.id}
                updateCartItemQuantity={handleUpdateCartItemQuantity}
                removeFromCart={handleRemoveFromCart}
              />
            ))}
          </div>
        )}
      </div>

      {cartItems.length > 0 && <CartSummary />}
    </div>
  );
};

export default CartSection;
