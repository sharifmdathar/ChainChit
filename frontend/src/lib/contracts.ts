import {
  invokeContract,
  addressToScVal,
  u64ToScVal,
  u32ToScVal,
  boolToScVal,
  stringToScVal,
  vecU8ToScVal,
  scValToU32,
  scValToU64,
  scValToBool,
  scValToString,
  scValToAddress,
  scValToVecU8,
} from "./stellar";
import type {
  GroupInfo,
  GroupState,
  MemberStatus,
  BidRecord,
  CycleState,
  ReputationData,
  DisputeRecord,
  DisputeStatus,
  DisputeDecision,
} from "@/types";

function env(name: string): string {
  const val = process.env[`NEXT_PUBLIC_CONTRACT_${name}`] || "";
  if (!val) throw new Error(`Contract ${name} not configured`);
  return val;
}

const CONTRACTS = {
  chitGroup: () => env("CHIT_GROUP"),
  reputation: () => env("REPUTATION"),
  identity: () => env("IDENTITY"),
  dispute: () => env("DISPUTE"),
};

// ===========================================================================
// ChitGroup Contract
// ===========================================================================

export async function initializeGroup(params: {
  admin: string;
  token: string;
  contributionAmount: number;
  numMembers: number;
  totalCycles: number;
  minAttestationScore: number;
  minReputationForBid: number;
}): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "initialize", [
    addressToScVal(params.admin),
    addressToScVal(params.token),
    addressToScVal(CONTRACTS.reputation()),
    addressToScVal(CONTRACTS.identity()),
    addressToScVal(CONTRACTS.dispute()),
    u64ToScVal(params.contributionAmount),
    u32ToScVal(params.numMembers),
    u32ToScVal(params.totalCycles),
    u32ToScVal(params.minAttestationScore),
    u32ToScVal(params.minReputationForBid),
  ]);
}

export async function joinGroup(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "join_group", []);
}

export async function startCollection(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "start_collection", []);
}

export async function payContribution(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "pay_contribution", []);
}

export async function commitBid(commitment: number[]): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "commit_bid", [
    vecU8ToScVal(commitment),
  ]);
}

export async function revealBid(amount: number, nonce: number): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "reveal_bid", [
    u64ToScVal(amount),
    u64ToScVal(nonce),
  ]);
}

export async function executePayout(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "execute_payout", []);
}

export async function advanceCycle(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "advance_cycle", []);
}

export async function raiseDispute(reason: string): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "raise_dispute", [
    stringToScVal(reason),
  ]);
}

export async function pauseGroup(): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "pause", []);
}

export async function unpauseGroup(resumeState: GroupState): Promise<void> {
  await invokeContract(CONTRACTS.chitGroup(), "unpause", [
    stringToScVal(resumeState),
  ]);
}

export async function getGroupInfo(): Promise<GroupInfo> {
  const result = await invokeContract(
    CONTRACTS.chitGroup(), "get_group_info", [], false
  );
  if (!result) throw new Error("No result from get_group_info");
  return parseGroupInfo(result);
}

export async function getMembers(): Promise<string[]> {
  const result = await invokeContract(
    CONTRACTS.chitGroup(), "get_members", [], false
  );
  if (!result) return [];
  return parseAddressVec(result);
}

export async function getCycleState(cycle: number): Promise<CycleState> {
  const result = await invokeContract(
    CONTRACTS.chitGroup(), "get_cycle_state", [u32ToScVal(cycle)], false
  );
  if (!result) throw new Error("No result from get_cycle_state");
  return parseCycleState(result);
}

export async function getMemberPaymentStatus(
  cycle: number, member: string
): Promise<MemberStatus> {
  const result = await invokeContract(
    CONTRACTS.chitGroup(), "get_member_payment_status",
    [u32ToScVal(cycle), addressToScVal(member)], false
  );
  if (!result) throw new Error("No result from get_member_payment_status");
  return scValToString(result) as MemberStatus;
}

// ===========================================================================
// Reputation Contract
// ===========================================================================

export async function authorizeReputationGroup(groupAddress: string): Promise<void> {
  await invokeContract(CONTRACTS.reputation(), "authorize_group", [
    addressToScVal(groupAddress),
  ]);
}

export async function getReputation(address: string): Promise<ReputationData> {
  const result = await invokeContract(
    CONTRACTS.reputation(), "get_reputation", [addressToScVal(address)], false
  );
  if (!result) throw new Error("No reputation data found");
  return parseReputationData(result, address);
}

export async function getOnTimeRatio(address: string): Promise<number> {
  const result = await invokeContract(
    CONTRACTS.reputation(), "get_on_time_ratio", [addressToScVal(address)], false
  );
  if (!result) return 0;
  return scValToU32(result);
}

export async function getCompositeScore(address: string): Promise<number> {
  const result = await invokeContract(
    CONTRACTS.reputation(), "get_composite_score", [addressToScVal(address)], false
  );
  if (!result) return 0;
  return scValToU32(result);
}

export async function isEstablished(address: string): Promise<boolean> {
  const result = await invokeContract(
    CONTRACTS.reputation(), "is_established", [addressToScVal(address)], false
  );
  if (!result) return false;
  return scValToBool(result);
}

// ===========================================================================
// Identity Contract
// ===========================================================================

export async function vouchFor(vouchee: string): Promise<void> {
  await invokeContract(CONTRACTS.identity(), "vouch", [addressToScVal(vouchee)]);
}

export async function getAttestationScore(address: string): Promise<number> {
  const result = await invokeContract(
    CONTRACTS.identity(), "get_attestation_score", [addressToScVal(address)], false
  );
  if (!result) return 0;
  return scValToU32(result);
}

export async function isAttested(address: string): Promise<boolean> {
  const result = await invokeContract(
    CONTRACTS.identity(), "is_attested", [addressToScVal(address)], false
  );
  if (!result) return false;
  return scValToBool(result);
}

export async function getVouchors(address: string): Promise<string[]> {
  const result = await invokeContract(
    CONTRACTS.identity(), "get_vouchors", [addressToScVal(address)], false
  );
  if (!result) return [];
  return parseAddressVec(result);
}

export async function getAttestationCount(address: string): Promise<number> {
  const result = await invokeContract(
    CONTRACTS.identity(), "get_attestation_count", [addressToScVal(address)], false
  );
  if (!result) return 0;
  return scValToU32(result);
}

// ===========================================================================
// Dispute Contract
// ===========================================================================

export async function getDispute(id: number): Promise<DisputeRecord> {
  const result = await invokeContract(
    CONTRACTS.dispute(), "get_dispute", [u64ToScVal(id)], false
  );
  if (!result) throw new Error("Dispute not found");
  return parseDisputeRecord(result);
}

export async function getArbitrators(): Promise<string[]> {
  const result = await invokeContract(
    CONTRACTS.dispute(), "get_arbitrators", [], false
  );
  if (!result) return [];
  return parseAddressVec(result);
}

export async function castVote(
  disputeId: number, inFavor: boolean, decision: DisputeDecision
): Promise<void> {
  await invokeContract(CONTRACTS.dispute(), "cast_vote", [
    u64ToScVal(disputeId),
    boolToScVal(inFavor),
    stringToScVal(decision),
  ]);
}

// ===========================================================================
// Parsers (Soroban ScVal → TypeScript types)
// ===========================================================================

import { xdr } from "@stellar/stellar-sdk";

function getMapValue(map: xdr.ScMapEntry[], key: string): xdr.ScVal | undefined {
  const entry = map.find(
    (e) =>
      e.key().switch().name === "scvSymbol" &&
      e.key().sym().toString() === key
  );
  return entry?.val();
}

function parseGroupInfo(val: xdr.ScVal): GroupInfo {
  const map = val.map();
  if (!map) throw new Error("Expected map for GroupInfo");
  const get = (key: string) => getMapValue(map, key);

  return {
    admin: scValToAddress(get("admin")!),
    token: scValToAddress(get("token")!),
    reputation_contract: scValToAddress(get("reputation_contract")!),
    identity_contract: scValToAddress(get("identity_contract")!),
    dispute_contract: scValToAddress(get("dispute_contract")!),
    contribution_amount: scValToU64(get("contribution_amount")!),
    num_members: scValToU32(get("num_members")!),
    total_cycles: scValToU32(get("total_cycles")!),
    current_cycle: scValToU32(get("current_cycle")!),
    state: scValToString(get("state")!) as GroupState,
    min_attestation_score: scValToU32(get("min_attestation_score")!),
    min_reputation_for_bid: scValToU32(get("min_reputation_for_bid")!),
  };
}

function parseCycleState(val: xdr.ScVal): CycleState {
  const map = val.map();
  if (!map) throw new Error("Expected map for CycleState");
  const get = (key: string) => getMapValue(map, key);

  const paymentsVal = get("payments");
  const payments: Record<string, MemberStatus> = {};
  if (paymentsVal?.map()) {
    for (const entry of paymentsVal.map()!) {
      const addr = scValToAddress(entry.key());
      const status = scValToString(entry.val()) as MemberStatus;
      payments[addr] = status;
    }
  }

  const bidsVal = get("bids");
  const bids: Record<string, BidRecord> = {};
  if (bidsVal?.map()) {
    for (const entry of bidsVal.map()!) {
      const addr = scValToAddress(entry.key());
      bids[addr] = parseBidRecord(entry.val());
    }
  }

  const winnerVal = get("winner");
  let winner: string | null = null;
  if (winnerVal && winnerVal.switch().name === "scvAddress") {
    winner = scValToAddress(winnerVal);
  }

  return {
    payments,
    bids,
    winner,
    winning_bid: scValToU64(get("winning_bid")!),
  };
}

function parseBidRecord(val: xdr.ScVal): BidRecord {
  const map = val.map();
  if (!map) throw new Error("Expected map for BidRecord");
  const get = (key: string) => getMapValue(map, key);

  return {
    commitment: scValToVecU8(get("commitment")!),
    revealed: scValToBool(get("revealed")!),
    amount: scValToU64(get("amount")!),
  };
}

function parseReputationData(val: xdr.ScVal, address: string): ReputationData {
  const map = val.map();
  if (!map) throw new Error("Expected map for ReputationData");
  const get = (key: string) => getMapValue(map, key);

  return {
    address,
    on_time_payments: scValToU32(get("on_time_payments")!),
    total_payments_due: scValToU32(get("total_payments_due")!),
    cycles_defaulted: scValToU32(get("cycles_defaulted")!),
    cycles_completed: scValToU32(get("cycles_completed")!),
    bids_won: scValToU32(get("bids_won")!),
    disputes_raised: scValToU32(get("disputes_raised")!),
    disputes_lost: scValToU32(get("disputes_lost")!),
  };
}

function parseDisputeRecord(val: xdr.ScVal): DisputeRecord {
  const map = val.map();
  if (!map) throw new Error("Expected map for DisputeRecord");
  const get = (key: string) => getMapValue(map, key);

  const decisionVal = get("decision");
  let decision: DisputeDecision | null = null;
  if (decisionVal && decisionVal.switch().name === "scvString") {
    decision = scValToString(decisionVal) as DisputeDecision;
  }

  const resolvedAtVal = get("resolved_at");
  let resolved_at: number | null = null;
  if (resolvedAtVal && resolvedAtVal.switch().name === "scvU64") {
    resolved_at = scValToU64(resolvedAtVal);
  }

  return {
    id: scValToU64(get("id")!),
    raiser: scValToAddress(get("raiser")!),
    cycle: scValToU64(get("cycle")!),
    reason: scValToString(get("reason")!),
    status: scValToString(get("status")!) as DisputeStatus,
    votes_for: parseAddressVec(get("votes_for")),
    votes_against: parseAddressVec(get("votes_against")),
    decision,
    resolved_at,
  };
}

function parseAddressVec(val: xdr.ScVal | undefined): string[] {
  if (!val) return [];
  if (val.switch().name === "scvVec") {
    return val.vec()!.map((v) => scValToAddress(v));
  }
  return [];
}
