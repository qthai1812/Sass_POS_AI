import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  selectedCustomer: null,
  note: "",
  discount: { type: "percentage", value: 0 },
  paymentMethod: "CASH",
  heldOrders: [],
  currentOrder: null,
  couponCode: null,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const product = action.payload;
      const existingItem = state.items.find((item) => item.id === product.id);

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        const productWithPrice = {
          ...product,
          quantity: 1,
        };
        state.items.push(productWithPrice);
      }
    },

    updateCartItemQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        state.items = state.items.filter((item) => item.id !== id);
      } else {
        const item = state.items.find((item) => item.id === id);
        if (item) {
          item.quantity = quantity;
        }
      }
    },

    removeFromCart: (state, action) => {
      const id = action.payload;
      state.items = state.items.filter((item) => item.id !== id);
    },

    clearCart: (state) => {
      state.items = [];
      state.selectedCustomer = null;
      state.note = "";
      state.discount = { type: "percentage", value: 0 };
      state.paymentMethod = "CASH";
      state.currentOrder = null;
      state.couponCode = null;
    },

    setSelectedCustomer: (state, action) => {
      const nextCustomer = action.payload;
      const prevCustomerId = state.selectedCustomer?.id;
      if (
        state.couponCode === "POINTS" &&
        (!nextCustomer || nextCustomer.id !== prevCustomerId)
      ) {
        state.couponCode = null;
        state.discount = { type: "percentage", value: 0 };
      }
      state.selectedCustomer = nextCustomer;
    },

    setCouponCode: (state, action) => {
      state.couponCode = action.payload;
    },

    setNote: (state, action) => {
      state.note = action.payload;
    },

    setDiscount: (state, action) => {
      state.discount = action.payload;
    },

    setPaymentMethod: (state, action) => {
      state.paymentMethod = action.payload
        ? action.payload.toUpperCase()
        : "CASH";
    },

    holdOrder: (state) => {
      if (state.items.length > 0) {
        const heldOrder = {
          id: Date.now(),
          items: [...state.items],
          customer: state.selectedCustomer,
          note: state.note,
          discount: state.discount,
          couponCode: state.couponCode,
          timestamp: new Date(),
        };
        state.heldOrders.push(heldOrder);

        state.items = [];
        state.selectedCustomer = null;
        state.note = "";
        state.discount = { type: "percentage", value: 0 };
        state.couponCode = null;
      }
    },

    resumeOrder: (state, action) => {
      const order = action.payload;
      state.items = order.items;
      state.selectedCustomer = order.customer;
      state.note = order.note;
      state.discount = order.discount || { type: "percentage", value: 0 };
      state.couponCode = order.couponCode || null;

      state.heldOrders = state.heldOrders.filter((o) => o.id !== order.id);
    },

    setCurrentOrder: (state, action) => {
      state.currentOrder = action.payload;
    },

    resetOrder: (state) => {
      state.items = [];
      state.selectedCustomer = null;
      state.note = "";
      state.discount = { type: "percentage", value: 0 };
      state.paymentMethod = "CASH";
      state.currentOrder = null;
      state.couponCode = null;
    },
  },
});

export const selectCartItems = (state) => state.cart.items;
export const selectCartItemCount = (state) => state.cart.items.length;
export const selectSelectedCustomer = (state) => state.cart.selectedCustomer;
export const selectNote = (state) => state.cart.note;
export const selectDiscount = (state) => state.cart.discount;
export const selectPaymentMethod = (state) => state.cart.paymentMethod;
export const selectHeldOrders = (state) => state.cart.heldOrders;
export const selectCurrentOrder = (state) => state.cart.currentOrder;
export const selectCouponCode = (state) => state.cart.couponCode;

export const selectSubtotal = (state) => {
  return state.cart.items.reduce(
    (total, item) =>
      total + (item.sellingPrice ?? item.price ?? 0) * item.quantity,
    0,
  );
};

export const selectTaxRate = (state) => {
  const rawRate = state.store?.store?.taxRate;
  const parsedRate =
    rawRate !== undefined && rawRate !== null && rawRate !== ""
      ? Number(rawRate)
      : 10;
  return Number.isFinite(parsedRate) ? Math.max(0, parsedRate) : 10;
};

export const selectTax = (state) => {
  const subtotal = selectSubtotal(state);
  const taxRate = selectTaxRate(state);
  return subtotal * (taxRate / 100);
};

export const selectDiscountAmount = (state) => {
  const subtotal = selectSubtotal(state);
  if (subtotal <= 0) return 0;

  if (state.cart.couponCode === "POINTS") {
    const pts = Math.max(
      0,
      Number(state.cart.selectedCustomer?.loyaltyPoints || 0),
    );
    return pts > 0 ? Math.min(pts, Math.floor(subtotal / 1000)) * 1000 : 0;
  }

  const discount = state.cart.discount;
  if (!discount || !discount.value) return 0;
  if (
    discount.minOrderValue &&
    subtotal < Number(discount.minOrderValue)
  ) {
    return 0;
  }
  if (discount.type === "percentage") {
    return Math.min(subtotal, subtotal * (discount.value / 100));
  } else {
    return Math.min(subtotal, Number(discount.value) || 0);
  }
};

export const selectTotal = (state) => {
  const subtotal = selectSubtotal(state);
  const tax = selectTax(state);
  const discountAmount = selectDiscountAmount(state);
  return Math.max(0, subtotal + tax - discountAmount);
};

export const {
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  setSelectedCustomer,
  setNote,
  setDiscount,
  setPaymentMethod,
  setCouponCode,
  holdOrder,
  resumeOrder,
  setCurrentOrder,
  resetOrder,
} = cartSlice.actions;

export default cartSlice.reducer;
