// Farmer wallet: balances, transaction history, payout account, deposits, and
// withdrawals. Every call goes through the backend because money is never
// calculated or stored on the device.
import { getAuth } from "firebase/auth";

import {
  FarmerPayoutAccountType,
  FarmerWalletType,
  FarmerWithdrawalType,
  WalletTransaction,
} from "../types/wallet";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

// The free Render tier can take 30 to 60 seconds to wake up, so 15 seconds was
// aborting healthy requests and showing a false "took too long" error.
const REQUEST_TIMEOUT = 30000;

// Calls that reach Xendit, such as deposits and withdrawals, take longer than a
// normal read. Aborting early would let the server keep working while the user
// sees a false error, so they get extra time.
const GATEWAY_REQUEST_TIMEOUT = 60000;

// A commission deposit the farmer started, with the Xendit checkout link.
export type CommissionDepositResult = {
  depositId: string;
  amount: number;
  paymentRequestId: string;
  referenceId: string;
  paymentStatus: string;
  redirectUrl: string;
};

// The stored state of one commission deposit.
export type CommissionDepositStatus = {
  id: string;
  farmerId: string;
  amount: number;
  status: string;
  referenceId: string | null;
  xenditPaymentStatus: string | null;
  failureReason: string | null;
  createdAt: any;
  updatedAt: any;
};

// Returns the ID token of the signed-in farmer.
const getFirebaseIdToken = async () => {
  const user = getAuth().currentUser;

  if (!user) {
    throw new Error("Your login session has expired. Please login again.");
  }

  return await user.getIdToken();
};

// Sends a signed-in request to the backend and returns the parsed body. Timeouts
// are retried once by default, which covers the Render cold-start window without
// making the farmer tap refresh.
const requestBackend = async <T = any>(
  path: string,
  options: RequestInit = {},
  timeout = REQUEST_TIMEOUT,
  retryOnTimeout = true
): Promise<T> => {
  if (!BACKEND_URL) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is not configured.");
  }

  const token = await getFirebaseIdToken();

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const status = response.status;
        // The HTTP status is kept so the UI can tell an expired session (401)
        // apart from a real server failure (500).
        const message =
          data?.error ||
          data?.message ||
          `Backend request failed with status ${status}.`;
        const err: any = new Error(message);
        err.status = status;
        // Which fields the Xendit gateway rejected, when it says.
        err.details = data?.details ?? null;
        throw err;
      }

      return data as T;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        const err: any = new Error(
          "The server is waking up (cold start). Please wait a moment and try again."
        );
        err.name = "AbortError";
        throw err;
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (error: any) {
    // One retry after a short wait, so a cold start does not look like a failure.
    if (retryOnTimeout && error?.name === "AbortError") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return await attempt();
    }

    throw error;
  }
};

// Reads the wallet of the signed-in farmer. Passing farmerId adds a check that
// the returned wallet really belongs to that farmer.
export const getFarmerWallet = async (
  farmerId?: string
): Promise<FarmerWalletType> => {
  const result = await requestBackend<{
    success: boolean;
    wallet: FarmerWalletType;
  }>("/wallet/me");

  if (farmerId && result.wallet.farmerId !== farmerId) {
    throw new Error("Wallet ownership verification failed.");
  }

  return result.wallet;
};

// Returns GCash earnings that have not cleared yet.
export const getPendingGcashEarnings = async (): Promise<number> => {
  const result = await requestBackend<{
    success: boolean;
    pendingBalance: number;
  }>("/wallet/pending-gcash");

  return Number(result.pendingBalance || 0);
};

// Returns the wallet history, newest first. Passing farmerId filters the list
// down to that farmer.
export const getWalletTransactions = async (
  farmerId?: string
): Promise<WalletTransaction[]> => {
  const result = await requestBackend<{
    success: boolean;
    transactions: WalletTransaction[];
  }>("/wallet/transactions");

  if (!farmerId) {
    return result.transactions;
  }

  return result.transactions.filter(
    (transaction) => transaction.farmerId === farmerId
  );
};

// Returns the farmer's GCash payout account, or null when none is set up.
export const getFarmerPayoutAccount =
  async (): Promise<FarmerPayoutAccountType | null> => {
    const result = await requestBackend<{
      success: boolean;
      payoutAccount: FarmerPayoutAccountType | null;
    }>("/wallet/payout-account");

    return result.payoutAccount;
  };

// Creates or updates the farmer's GCash payout account.
export const saveFarmerPayoutAccount = async (input: {
  accountName: string;
  accountNumber: string;
  postalCode?: string;
}): Promise<FarmerPayoutAccountType> => {
  const result = await requestBackend<{
    success: boolean;
    payoutAccount: FarmerPayoutAccountType;
  }>("/wallet/payout-account", {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return result.payoutAccount;
};

// Requests a payout. Always pass the amount the farmer confirmed on screen,
// because the backend rejects anything larger than the current withdrawable
// balance.
export const requestFarmerWithdrawal = async (
  amount?: number
): Promise<FarmerWithdrawalType> => {
  const result = await requestBackend<{
    success: boolean;
    withdrawal: FarmerWithdrawalType;
    withdrawableAmount?: number;
  }>(
    "/wallet/withdraw",
    {
      method: "POST",
      body: JSON.stringify(amount === undefined ? {} : { amount }),
    },
    GATEWAY_REQUEST_TIMEOUT
  );

  return result.withdrawal;
};

// Starts a commission deposit and returns the Xendit checkout link the farmer
// has to open to pay.
export const createCommissionDeposit =
  async (amount: number): Promise<CommissionDepositResult> => {
    const result = await requestBackend<{
      success: boolean;
      depositId: string;
      amount: number;
      paymentRequestId: string;
      referenceId: string;
      paymentStatus: string;
      redirectUrl: string;
    }>(
      "/wallet/deposit",
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      },
      GATEWAY_REQUEST_TIMEOUT
    );

    if (!result.redirectUrl) {
      throw new Error("Xendit did not return a payment URL.");
    }

    return result;
  };

// Reads the current state of a commission deposit.
export const getCommissionDepositStatus = async (
  depositId: string
): Promise<CommissionDepositStatus> => {
  if (!depositId) {
    throw new Error("Deposit ID is required.");
  }

  const result = await requestBackend<{
    success: boolean;
    deposit: CommissionDepositStatus;
  }>(`/wallet/deposits/${encodeURIComponent(depositId)}`);

  return result.deposit;
};

// The withdrawable amount is the available balance minus the part of it that
// is held for payouts still in flight.
export const getWalletSummary = async (farmerId?: string) => {
  const [wallet, payoutAccount] = await Promise.all([
    getFarmerWallet(farmerId),
    getFarmerPayoutAccount(),
  ]);

  const withdrawableAmount = Math.max(
    0,
    Number(wallet.availableBalance || 0) - Number(wallet.reservedBalance || 0)
  );

  return {
    wallet,
    payoutAccount,
    withdrawableAmount,
  };
};

// Everything the wallet screen needs.
export type WalletOverview = {
  wallet: FarmerWalletType;
  payoutAccount: FarmerPayoutAccountType | null;
  transactions: WalletTransaction[];
  withdrawableAmount: number;
  minimumCommissionDeposit: number;
  minimumWithdrawal: number;
};

// Loads the wallet screen in one roundtrip, where the server checks auth once
// and then fetches the wallet, payout account, and history in parallel. If the
// backend has not been redeployed yet and has no /overview route, this falls
// back to the three older requests.
export const getWalletOverview = async (): Promise<WalletOverview> => {
  try {
    const result = await requestBackend<{
      success: boolean;
      wallet: FarmerWalletType;
      payoutAccount: FarmerPayoutAccountType | null;
      transactions: WalletTransaction[];
      withdrawableAmount: number;
      minimumCommissionDeposit: number;
      minimumWithdrawal: number;
    }>("/wallet/overview");

    return {
      wallet: result.wallet,
      payoutAccount: result.payoutAccount,
      transactions: Array.isArray(result.transactions)
        ? result.transactions
        : [],
      withdrawableAmount: Number(result.withdrawableAmount || 0),
      minimumCommissionDeposit: Number(result.minimumCommissionDeposit || 100),
      minimumWithdrawal: Number(result.minimumWithdrawal || 1),
    };
  } catch (error: any) {
    // A 404 here means the backend has not been redeployed yet.
    if (error?.status !== 404) throw error;

    console.log("Overview route missing on server, using legacy wallet calls.");

    const [walletRes, payoutRes, txRes] = await Promise.all([
      requestBackend<{ success: boolean; wallet: FarmerWalletType }>(
        "/wallet/me",
        {},
        REQUEST_TIMEOUT,
        false
      ),
      requestBackend<{
        success: boolean;
        payoutAccount: FarmerPayoutAccountType | null;
      }>("/wallet/payout-account", {}, REQUEST_TIMEOUT, false),
      requestBackend<{ success: boolean; transactions: WalletTransaction[] }>(
        "/wallet/transactions",
        {},
        REQUEST_TIMEOUT,
        false
      ),
    ]);

    const withdrawableAmount = Math.max(
      0,
      Number(walletRes.wallet?.availableBalance || 0) -
        Number(walletRes.wallet?.reservedBalance || 0)
    );

    return {
      wallet: walletRes.wallet,
      payoutAccount: payoutRes.payoutAccount,
      transactions: Array.isArray(txRes.transactions) ? txRes.transactions : [],
      withdrawableAmount,
      minimumCommissionDeposit: 100,
      minimumWithdrawal: 1,
    };
  }
};

// What the sync check did with each withdrawal it looked at.
export type WithdrawalSyncResult = {
  success: boolean;
  checked: number;
  synced: number;
  stillPending: number;
  results: {
    id: string;
    status: string;
    synced: boolean;
    xenditStatus?: string | null;
    reason?: string;
  }[];
};

// Repairs withdrawals stuck on pending or processing because the Xendit payout
// webhook never arrived, for example after a wrong webhook URL or token. Safe to
// call at any time, because the server does nothing when none are stuck.
export const syncStuckWithdrawals = async (): Promise<WithdrawalSyncResult> =>
  requestBackend<WithdrawalSyncResult>(
    "/wallet/withdrawals/sync",
    { method: "POST" },
    GATEWAY_REQUEST_TIMEOUT,
    false
  );
