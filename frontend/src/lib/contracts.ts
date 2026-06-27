import {
  invokeContract,
  addressToScVal,
  u64ToScVal,
  u32ToScVal,
  boolToScVal,
  stringToScVal,
  vecU8ToScVal,
  bytesN32ToScVal,
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
  let val = "";
  if (name === "FACTORY") {
    val = process.env.NEXT_PUBLIC_CONTRACT_FACTORY || process.env.NEXT_PUBLIC_FACTORY_CONTRACT || "";
  } else if (name === "REPUTATION") {
    val = process.env.NEXT_PUBLIC_CONTRACT_REPUTATION || process.env.NEXT_PUBLIC_REPUTATION_CONTRACT || "";
  } else if (name === "IDENTITY") {
    val = process.env.NEXT_PUBLIC_CONTRACT_IDENTITY || process.env.NEXT_PUBLIC_IDENTITY_CONTRACT || "";
  } else if (name === "DISPUTE") {
    val = process.env.NEXT_PUBLIC_CONTRACT_DISPUTE || process.env.NEXT_PUBLIC_DISPUTE_CONTRACT || "";
  } else if (name === "USDC") {
    val = process.env.NEXT_PUBLIC_CONTRACT_USDC || process.env.NEXT_PUBLIC_USDC_CONTRACT || "";
  }
  if (!val) throw new Error(`Contract ${name} not configured`);
  return val;
}

const CONTRACTS = {
  chitGroup: () => env("CHIT_GROUP"),
  factory: () => env("FACTORY"),
  reputation: () => env("REPUTATION"),
  identity: () => env("IDENTITY"),
  dispute: () => env("DISPUTE"),
};

// ===========================================================================
// Factory Contract
// ===========================================================================

export async function createGroup(params: {
  caller: string;
  salt: Uint8Array;
  token: string;
  contributionAmount: number;
  numMembers: number;
  totalCycles: number;
  minAttestationScore: number;
  minReputationForBid: number;
}): Promise<string> {
  const result = await invokeContract(CONTRACTS.factory(), "create_group", [
    addressToScVal(params.caller),
    bytesN32ToScVal(params.salt),
    addressToScVal(params.token),
    u64ToScVal(params.contributionAmount),
    u32ToScVal(params.numMembers),
    u32ToScVal(params.totalCycles),
    u32ToScVal(params.minAttestationScore),
    u32ToScVal(params.minReputationForBid),
  ]);
  if (!result) throw new Error("No result from create_group");
  return scValToAddress(result);
}

export async function getUserGroups(user: string): Promise<string[]> {
  const result = await invokeContract(CONTRACTS.factory(), "get_user_groups", [
    addressToScVal(user)
  ], false);
  if (!result) return [];
  return parseAddressVec(result);
}

// ===========================================================================
// ChitGroup Contract
// ===========================================================================

export async function joinGroup(contractId: string): Promise<void> {
  await invokeContract(contractId, "join_group", []);
}

export async function startCollection(contractId: string): Promise<void> {
  await invokeContract(contractId, "start_collection", []);
}

export async function payContribution(contractId: string): Promise<void> {
  await invokeContract(contractId, "pay_contribution", []);
}

export async function commitBid(contractId: string, commitment: number[]): Promise<void> {
  await invokeContract(contractId, "commit_bid", [
    vecU8ToScVal(commitment),
  ]);
}

export async function revealBid(contractId: string, amount: number, nonce: number): Promise<void> {
  await invokeContract(contractId, "reveal_bid", [
    u64ToScVal(amount),
    u64ToScVal(nonce),
  ]);
}

export async function executePayout(contractId: string): Promise<void> {
  await invokeContract(contractId, "execute_payout", []);
}

export async function advanceCycle(contractId: string): Promise<void> {
  await invokeContract(contractId, "advance_cycle", []);
}

export async function raiseDispute(contractId: string, reason: string): Promise<void> {
  await invokeContract(contractId, "raise_dispute", [
    stringToScVal(reason),
  ]);
}

export async function pauseGroup(contractId: string): Promise<void> {
  await invokeContract(contractId, "pause", []);
}

export async function unpauseGroup(contractId: string, resumeState: GroupState): Promise<void> {
  await invokeContract(contractId, "unpause", [
    stringToScVal(resumeState),
  ]);
}

export async function getGroupInfo(contractId: string): Promise<GroupInfo> {
  const result = await invokeContract(
    contractId, "get_group_info", [], false
  );
  if (!result) throw new Error("No result from get_group_info");
  return parseGroupInfo(result);
}

export async function getMembers(contractId: string): Promise<string[]> {
  const result = await invokeContract(
    contractId, "get_members", [], false
  );
  if (!result) return [];
  return parseAddressVec(result);
}

export async function getCycleState(contractId: string, cycle: number): Promise<CycleState> {
  const result = await invokeContract(
    contractId, "get_cycle_state", [u32ToScVal(cycle)], false
  );
  if (!result) throw new Error("No result from get_cycle_state");
  return parseCycleState(result);
}

export async function getMemberPaymentStatus(
  contractId: string, cycle: number, member: string
): Promise<MemberStatus> {
  const result = await invokeContract(
    contractId, "get_member_payment_status",
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

function debugWrapParser<T>(fnName: string, val: any, fn: () => T): T {
  try {
    return fn();
  } catch (err: any) {
    console.error(`[DEBUG PARSER] Error in ${fnName}:`, err);
    try {
      if (val && typeof val.switch === "function") {
        console.error(`[DEBUG PARSER] Val switch name:`, val.switch().name);
        console.error(`[DEBUG PARSER] Val JSON:`, JSON.stringify(val));
      } else {
        console.error(`[DEBUG PARSER] Val is:`, val);
      }
    } catch (e) {
      console.error(`[DEBUG PARSER] Failed to print details:`, e);
    }
    throw err;
  }
}

function parseGroupInfo(val: xdr.ScVal): GroupInfo {
  return debugWrapParser("parseGroupInfo", val, () => {
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
  });
}

function parseCycleState(val: xdr.ScVal): CycleState {
  return debugWrapParser("parseCycleState", val, () => {
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
  });
}

function parseBidRecord(val: xdr.ScVal): BidRecord {
  return debugWrapParser("parseBidRecord", val, () => {
    const map = val.map();
    if (!map) throw new Error("Expected map for BidRecord");
    const get = (key: string) => getMapValue(map, key);

    return {
      commitment: scValToVecU8(get("commitment")!),
      revealed: scValToBool(get("revealed")!),
      amount: scValToU64(get("amount")!),
    };
  });
}

function parseReputationData(val: xdr.ScVal, address: string): ReputationData {
  return debugWrapParser("parseReputationData", val, () => {
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
  });
}

function parseDisputeRecord(val: xdr.ScVal): DisputeRecord {
  return debugWrapParser("parseDisputeRecord", val, () => {
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
  });
}

function parseAddressVec(val: xdr.ScVal | undefined): string[] {
  if (!val) return [];
  if (val.switch().name === "scvVec") {
    return val.vec()!.map((v) => scValToAddress(v));
  }
  return [];
}
