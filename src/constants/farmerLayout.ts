import { Platform } from "react-native";

export const FARMER_TAB_BAR_HEIGHT = Platform.OS === "ios" ? 80 : 64;
export const FARMER_CONTENT_BOTTOM_GAP = 30;

export const getFarmerTabBarClearance = (bottomInset: number) =>
  FARMER_TAB_BAR_HEIGHT + bottomInset + FARMER_CONTENT_BOTTOM_GAP;

export const getFarmerScreenBottomPadding = (bottomInset: number) =>
  bottomInset + FARMER_CONTENT_BOTTOM_GAP;
