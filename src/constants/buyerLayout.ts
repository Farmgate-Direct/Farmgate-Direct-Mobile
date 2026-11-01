import { Platform } from "react-native";

export const BUYER_TAB_BAR_HEIGHT =
  Platform.OS === "ios" ? 80 : 64;
export const BUYER_TAB_BAR_LIFT = 20;
export const BUYER_CONTENT_GAP = 16;

export const getBuyerTabBarClearance = (
  bottomInset: number,
  contentGap = BUYER_CONTENT_GAP
) =>
  BUYER_TAB_BAR_HEIGHT + BUYER_TAB_BAR_LIFT + bottomInset + contentGap;

export const getBuyerTabBarContentClearance = (
  bottomInset: number,
  contentGap = BUYER_CONTENT_GAP
) => BUYER_TAB_BAR_HEIGHT + bottomInset + contentGap;
