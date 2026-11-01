// Root layout. Wraps every screen in the shared providers and declares the
// screens the navigator knows about.
import "./global.css";
import { CartProvider } from "@/src/context/CartContext";
import { Stack } from "expo-router";
import { ToastProvider } from "@/src/context/ToastContext";
import { FarmerAlertProvider } from "@/src/context/FarmerAlertContext";

export default function RootLayout() {
  return (
    <ToastProvider>
      <FarmerAlertProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="buyer/(tabs)" />
            <Stack.Screen name="farmer/(tabs)" />
            <Stack.Screen name="farmer/products/[id]" />
            <Stack.Screen name="farmer/products/top-selling" />
            <Stack.Screen name="products/[id]" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="buyer/cart/myCart" />
          </Stack>
        </CartProvider>
      </FarmerAlertProvider>
    </ToastProvider>
  );
}
