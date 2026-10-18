// Best selling products of the past week, used by the leaderboard screen.
import { getAuth } from "firebase/auth";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

// How many units of one product sold during the week.
export type WeeklyProductSales = {
  productId: string;
  unitsSold: number;
};

// Asks the backend for this week's best sellers. Requires a signed-in user
// because the endpoint needs the caller's ID token.
export const getWeeklyProductSales =
  async (): Promise<WeeklyProductSales[]> => {
    if (!BACKEND_URL) {
      throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
    }

    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("Your login session has expired. Please login again.");
    }

    const token = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/buyer/leaderboards/weekly`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data?.error || `Unable to load weekly sales (${response.status}).`
      );
    }

    if (!Array.isArray(data?.products)) {
      throw new Error("The weekly sales response is invalid.");
    }

    return data.products;
  };
