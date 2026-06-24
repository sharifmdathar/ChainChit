export interface Address {
  toString(): string;
}

export type GroupState =
  | "Forming"
  | "Collecting"
  | "Bidding"
  | "Payout"
  | "Completed"
  | "Paused";

export type MemberStatus = "Pending" | "Paid" | "Defaulted" | "Disputed";

export interface GroupInfo {
  admin: string;
  token: string;
  reputation_contract: string;
  identity_contract: string;
  dispute_contract: string;
  contribution_amount: number;
  num_members: number;
  total_cycles: number;
  current_cycle: number;
  state: GroupState;
  min_attestation_score: number;
  min_reputation_for_bid: number;
}

export interface BidRecord {
  commitment: number[];
  revealed: boolean;
  amount: number;
}

export interface CycleState {
  payments: Record<string, MemberStatus>;
  bids: Record<string, BidRecord>;
  winner: string | null;
  winning_bid: number;
}

export interface ReputationData {
  address: string;
  on_time_payments: number;
  total_payments_due: number;
  cycles_defaulted: number;
  cycles_completed: number;
  bids_won: number;
  disputes_raised: number;
  disputes_lost: number;
}

export type DisputeStatus = "Open" | "Voting" | "Resolved" | "Dismissed";

export type DisputeDecision =
  | "Dismiss"
  | "ReversePayout"
  | "ForceDefault"
  | "PartialRefund";

export interface DisputeRecord {
  id: number;
  raiser: string;
  cycle: number;
  reason: string;
  status: DisputeStatus;
  votes_for: string[];
  votes_against: string[];
  decision: DisputeDecision | null;
  resolved_at: number | null;
}

export interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  network: "PUBLIC" | "TESTNET" | "FUTURENET";
}

export interface Sep24DepositResponse {
  id: string;
  type: "interactive_customer_info_needed";
  url: string;
  attributes: {
    interactive_customer_info_needed: {
      url: string;
    };
  };
}

export interface Sep24Transaction {
  id: string;
  kind: "deposit" | "withdrawal";
  status: string;
  amount_in: string;
  amount_out: string;
  started_at: string;
  completed_at: string | null;
}
