// A themed replacement for the system Alert.alert, so farmer screens can show
// their own dialog with buttons, icons, and colors.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { AlertButton, AlertOptions } from "react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// The dialog currently on screen, kept in state so it can be dismissed.
type FarmerAlertData = {
  title: string;
  message: string;
  buttons: AlertButton[];
  cancelable: boolean;
};

type FarmerAlertContextValue = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => void;
};

const FarmerAlertContext = createContext<FarmerAlertContextValue | null>(null);

export function FarmerAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentAlert, setCurrentAlert] = useState<FarmerAlertData | null>(null);

  const alert = useCallback((
    title: string,
    message = "",
    buttons: AlertButton[] = [{ text: "OK" }],
    options?: AlertOptions
  ) => {
    setCurrentAlert({
      title,
      message,
      buttons,
      cancelable: options?.cancelable ?? true,
    });
  }, []);

  const closeAlert = () => setCurrentAlert(null);
  const contextValue = useMemo(() => ({ alert }), [alert]);
  // Tapping outside the card or the Android back button closes the dialog,
  // unless the caller marked it as not cancelable.
  const dismissAlert = () => {
    if (currentAlert?.cancelable !== false) {
      closeAlert();
    }
  };

  // The icon is picked from the wording of the title and the number of buttons,
  // so screens do not have to describe the dialog themselves.
  const isError =
    /error|failed|invalid|denied|not completed|required|unable|insufficient|stock/i.test(
      currentAlert?.title || ""
    );
  const isConfirmation = currentAlert?.buttons.length
    ? currentAlert.buttons.length > 1
    : false;
  const iconName = isError
    ? "alert-circle-outline"
    : isConfirmation
      ? "help-circle-outline"
      : "check-circle-outline";
  const iconColor = isError ? "#dc2626" : "#14532d";

  return (
    <FarmerAlertContext.Provider value={contextValue}>
      {children}
      <Modal
        transparent
        visible={!!currentAlert}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissAlert}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/45 px-6"
          onPress={dismissAlert}
        >
          <Pressable
            className="w-full max-w-[380px] rounded-[10px] bg-white p-6"
            style={{
              borderWidth: 1,
              borderColor: "#14532d",
              borderRadius: 10,
              overflow: "hidden",
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="mb-4 items-center">
              <View
                className="mb-3 h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: isError ? "#fef2f2" : "#f0fdf4" }}
              >
                <MaterialCommunityIcons
                  name={iconName}
                  size={30}
                  color={iconColor}
                />
              </View>
              <Text className="text-center text-lg font-bold text-gray-900">
                {currentAlert?.title}
              </Text>
            </View>

            {!!currentAlert?.message && (
              <ScrollView className="mb-6" style={{ maxHeight: 280 }}>
                <Text className="text-center text-sm leading-5 text-gray-600">
                  {currentAlert.message}
                </Text>
              </ScrollView>
            )}

            <View
              className={
                currentAlert?.buttons.length === 2
                  ? "flex-row"
                  : "flex-col"
              }
            >
              {currentAlert?.buttons.map((button, index) => {
                const destructive = button.style === "destructive";
                const cancel = button.style === "cancel";
                const multiButton = currentAlert.buttons.length > 1;

                return (
                  <TouchableOpacity
                    key={`${button.text || "button"}-${index}`}
                    accessibilityRole="button"
                    onPress={() => {
                      closeAlert();
                      button.onPress?.();
                    }}
                    className={`items-center justify-center rounded-[10px] px-4 py-3 ${
                      multiButton ? "flex-1" : "w-full"
                    } ${index > 0 && currentAlert.buttons.length === 2 ? "ml-3" : ""} ${
                      index > 0 && currentAlert.buttons.length > 2 ? "mt-2" : ""
                    }`}
                    style={{
                      backgroundColor: destructive
                        ? "#dc2626"
                        : cancel
                          ? "#f3f4f6"
                          : "#14532d",
                    }}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        cancel ? "text-gray-700" : "text-white"
                      }`}
                    >
                      {button.text || "OK"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FarmerAlertContext.Provider>
  );
}

// Returns the alert dialog. Must be used inside FarmerAlertProvider.
export function useFarmerAlert() {
  const context = useContext(FarmerAlertContext);
  if (!context) {
    throw new Error("useFarmerAlert must be used within FarmerAlertProvider.");
  }
  return context;
}

// Shorter name used by most screens.
export function useAppAlert() {
  return useFarmerAlert();
}
