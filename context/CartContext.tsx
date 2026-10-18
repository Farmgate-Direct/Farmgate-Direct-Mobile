// In-memory shopping cart shared by the buyer screens.
import React, { createContext, useContext, useState } from "react";

// One product line in the cart.
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  farmerId: string;
  farmName: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  clearCart: () => void;
  updateQuantity: (itemId: string, qty: number) => void;
}

const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  clearCart: () => {},
  updateQuantity: () => {},
});

// Wraps the screens that need the cart and provides the actions below.
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Adding a product that is already in the cart raises its quantity instead of
  // creating a second line.
  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setCart((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: qty } : i))
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, clearCart, updateQuantity }}>
      {children}
    </CartContext.Provider>
  );
};

// Reads the cart and its actions. Must be used inside CartProvider.
export const useCart = () => useContext(CartContext);