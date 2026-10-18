// The farmer wallet: balances, the transaction ledger, the GCash payout
// account, and withdrawals. Every balance change is recorded as a
// WalletTransaction so the numbers on screen can always be traced back.
export type WalletTransactionType =
  | "gcash_earning"
  | "gcash_commission"
  | "cod_commission_reserved"
  | "cod_commission_reservation_released"
  | "cod_commission_debit"
  | "cod_commission_due"
  | "cod_commission_collected"
  | "cod_delivery_fee_due"
  | "cod_delivery_fee_collected"
  | "commission_deposit"
  | "withdrawal"
  | "withdrawal_reversal"
  | "adjustment";

// Whether an entry adds to the balance, takes from it, or is only a record of
// something that happened.
export type WalletTransactionDirection =
  | "credit"
  | "debit"
  | "memo";

// Where a ledger entry is in its lifecycle. A reversed or failed entry still
// stays on the record, it just stops counting toward the balance.
export type WalletTransactionStatus =
  | "pending"
  | "completed"
  | "reversed"
  | "failed";

export type FarmerWalletType = {
  farmerId: string;

  availableBalance: number;

  // GCash earnings that are not available yet. COD money is not counted here.
  pendingBalance: number;

  reservedBalance: number;

  commissionReserveBalance: number;

  commissionReserveHeld: number;

  totalCommissionDeposited: number;

  totalCodCommissionPaid: number;

  // Older fields kept so documents written before the current wallet model
  // still read correctly.
  codCommissionDue: number;

  codDeliveryFeeDue: number;

  totalEarned: number;

  totalWithdrawn: number;

  totalGcashEarnings: number;

  minimumReserve: number;

  currency: "PHP";

  createdAt?: any;

  updatedAt?: any;
};

export type WalletTransaction = {
  id: string;

  farmerId: string;

  type: WalletTransactionType;

  direction: WalletTransactionDirection;

  amount: number;

  balanceAfter: number;

  commissionReserveAfter?: number;

  commissionReserveHeldAfter?: number;

  codCommissionDueAfter?: number;

  codDeliveryFeeDueAfter?: number;

  orderId?: string;

  orderNumber?: string;

  withdrawalId?: string;

  depositId?: string;

  status: WalletTransactionStatus;

  description: string;

  createdAt?: any;

  completedAt?: any;
};

export type PayoutAccountStatus =
  | "active"
  | "inactive";

// The saved GCash number the farmer's money goes out to. Only the masked form
// is kept here; the full number lives with the payment provider.
export type FarmerPayoutAccountType = {
  farmerId: string;

  method: "gcash";

  channel: "PH_GCASH";

  accountName: string;

  postalCode?: string;

  accountNumberMasked: string;

  status: PayoutAccountStatus;

  createdAt?: any;

  updatedAt?: any;
};

export type FarmerWithdrawalStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "reversed"
  | "rejected"
  | "pending_compliance";

// A GCash payout request. amount is what the farmer asked for, netAmount is
// what actually arrives after the payout fee, and the idempotencyKey stops a
// retry from sending the money twice.
export type FarmerWithdrawalType = {
  id: string;

  farmerId: string;

  amount: number;

  minimumReserve: number;

  codCommissionDue?: number;

  codDeliveryFeeDue?: number;

  payoutFee: number;

  netAmount: number;

  payoutMethod: "gcash";

  accountName: string;

  postalCode?: string;

  accountNumberMasked: string;

  status: FarmerWithdrawalStatus;

  xenditPayoutId?: string;

  xenditReferenceId?: string;

  failureCode?: string;

  failureReason?: string;

  idempotencyKey: string;

  requestedAt?: any;

  processingAt?: any;

  completedAt?: any;

  failedAt?: any;
};

// Everything the balance screen needs in one read: the wallet itself, the
// payout account, and how much of it can be withdrawn right now.
export type WalletSummary = {
  wallet: FarmerWalletType;

  payoutAccount:
    | FarmerPayoutAccountType
    | null;

  withdrawableAmount: number;
};