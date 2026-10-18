// Shows a small popup at the top of the screen for success, error, or info messages.
import Toast from "react-native-toast-message";

type ToastType = "success" | "error" | "info";

export const showToast = (
  type: ToastType,
  text1: string,
  text2?: string
) => {
  Toast.show({
    type,
    text1,
    text2,
    position: "top",
    // Messages disappear on their own after 3 seconds.
    visibilityTime: 3000,
    autoHide: true,
  });
};