// A small centered popup used for quick confirmations on top of the app.
import React, { createContext, useContext, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

type ToastContextType = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  // Fades the popup in, then fades it out and hides it after two seconds.
  const showToast = (msg: string) => {
    setMessage(msg);
    setVisible(true);

    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, 2000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {visible && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={{
              opacity,
              backgroundColor: "white",
              borderWidth: 1,
              borderColor: "#cacfcd",
              borderRadius: 10,
              paddingVertical: 14,
              paddingHorizontal: 24,
              elevation: 6,
              shadowColor: "#9fa1a0",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              maxWidth: "80%",
            }}
          >
            <Text style={{ color: "#14532d", fontWeight: "600", textAlign: "center" }}>
              {message}
            </Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

// Returns the showToast function. Must be used inside ToastProvider.
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};