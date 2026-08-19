import {
  StellarWalletsKit,
  FREIGHTER_ID,
  WalletNetwork,
  FreighterModule,
} from "@creit.tech/stellar-wallets-kit";
import {
  isConnected as isFreighterConnected,
  requestAccess as requestFreighterAccess,
  signTransaction as signFreighterTransaction,
  getNetwork as getFreighterNetwork,
} from "@stellar/freighter-api";
import { Address, Keypair, TransactionBuilder, rpc, Contract, xdr, Asset, Operation } from "@stellar/stellar-sdk";

let kit: StellarWalletsKit | null = null;
let activeAddress: string | null = null;

// Mock wallet gating — enabled ONLY when explicitly opted in via env.
// In production this defaults to OFF, ensuring no silent mock fallback.
const MOCK_WALLET_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MOCK_WALLET === "true";

let _mockKeypair: Keypair | null = null;

function getMockKeypair(): Keypair | null {
  if (!MOCK_WALLET_ENABLED) return null;
  if (_mockKeypair) return _mockKeypair;
  const secret = process.env.NEXT_PUBLIC_MOCK_WALLET_SECRET;
  if (!secret) return null;
  try {
    _mockKeypair = Keypair.fromSecret(secret);
    return _mockKeypair;
  } catch {
    console.error("[MOCK] Invalid MOCK_WALLET_SECRET in env");
    return null;
  }
}

const MOCK_KEYPAIR: Keypair | null = getMockKeypair();
const MOCK_ADDRESS: string | null = MOCK_KEYPAIR?.publicKey() ?? null;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: getNetwork(),
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule()],
    });
  }
  return kit;
}

export function getRpcServer(): rpc.Server {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://rpc.stellar.org";
  return new rpc.Server(rpcUrl, { allowHttp: false });
}

export function getNetworkPassphrase(): string {
  const network = process.env.NEXT_PUBLIC_NETWORK || "PUBLIC";
  return network === "TESTNET"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";
}

export function getNetwork(): WalletNetwork {
  const network = process.env.NEXT_PUBLIC_NETWORK || "PUBLIC";
  return network === "TESTNET" ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC;
}

export function getAppNetworkName(): "TESTNET" | "PUBLIC" {
  return process.env.NEXT_PUBLIC_NETWORK === "TESTNET" ? "TESTNET" : "PUBLIC";
}

export async function connectWallet(walletId: string = FREIGHTER_ID): Promise<string> {
  if (walletId === "MOCK") {
    if (!MOCK_ADDRESS) {
      throw new Error(
        "Mock wallet unavailable. Set NEXT_PUBLIC_ENABLE_MOCK_WALLET=true and NEXT_PUBLIC_MOCK_WALLET_SECRET."
      );
    }
    activeAddress = MOCK_ADDRESS;
    return MOCK_ADDRESS;
  }

  const connected = await isFreighterConnected();
  if (!connected) {
    throw new Error("Freighter wallet not installed or not connected");
  }
  const res = await requestFreighterAccess();
  const walletNetwork = await getFreighterNetwork();
  if (walletNetwork.network !== getAppNetworkName()) {
    throw new Error(
      `Freighter is on ${walletNetwork.network} but ChainChit runs on ${getAppNetworkName()}. Switch your Freighter network and reconnect.`
    );
  }
  activeAddress = res.address;
  return res.address;
}

export async function disconnectWallet(): Promise<void> {
  kit = null;
  activeAddress = null;
}

export async function getPublicKey(): Promise<string | null> {
  if (activeAddress) return activeAddress;
  try {
    const connected = await isFreighterConnected();
    if (connected) {
      const res = await requestFreighterAccess();
      activeAddress = res.address;
      return activeAddress;
    }
  } catch {}
  return null;
}

export async function signAndSendTransaction(
  txXdr: string
): Promise<rpc.Api.SendTransactionResponse> {
  const networkPassphrase = getNetworkPassphrase();
  let signedTxXdr = txXdr;

  if (MOCK_KEYPAIR && activeAddress === MOCK_ADDRESS) {
    const tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    tx.sign(MOCK_KEYPAIR);
    signedTxXdr = tx.toXDR();
  } else {
    const res = await signFreighterTransaction(txXdr, {
      networkPassphrase,
    });
    signedTxXdr = res.signedTxXdr;
  }

  const server = getRpcServer();
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
  const sendResponse = await server.sendTransaction(signedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Transaction failed: ${sendResponse.errorResult}`);
  }

  // Wait for confirmation
  let pollResponse = await server.getTransaction(sendResponse.hash);
  let attempts = 0;
  while (
    pollResponse.status === "NOT_FOUND" &&
    attempts < 20
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    pollResponse = await server.getTransaction(sendResponse.hash);
    attempts++;
  }

  if (pollResponse.status === "NOT_FOUND") {
    throw new Error("Transaction timed out");
  }

  if (pollResponse.status === "FAILED") {
    throw new Error(`Transaction failed: ${pollResponse.resultXdr}`);
  }

  return sendResponse;
}

export function getContract(contractId: string): Contract {
  return new Contract(contractId);
}

export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sign: boolean = true
): Promise<xdr.ScVal | undefined> {
  const server = getRpcServer();
  const networkPassphrase = getNetworkPassphrase();
  let publicKey = activeAddress;
  if (!publicKey) {
    publicKey = await getPublicKey();
  }
  if (!publicKey) {
    throw new Error("Wallet not connected");
  }

  const contract = getContract(contractId);
  const account = await server.getAccount(publicKey);

  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResponse = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation error: ${simResponse.error}`);
  }

  const assembledTx = rpc.assembleTransaction(tx, simResponse).build();

  if (!sign) {
    return simResponse.result?.retval;
  }

  await signAndSendTransaction(assembledTx.toXDR());
  return simResponse.result?.retval;
}

export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

export function u64ToScVal(value: number): xdr.ScVal {
  return xdr.ScVal.scvU64(new xdr.Uint64(BigInt(Math.round(value))));
}

export function u32ToScVal(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(Math.round(value));
}

export function boolToScVal(value: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(value);
}

export function stringToScVal(value: string): xdr.ScVal {
  return xdr.ScVal.scvString(value);
}

export function vecU8ToScVal(bytes: number[]): xdr.ScVal {
  const vec = bytes.map((b) => xdr.ScVal.scvU32(b));
  return xdr.ScVal.scvVec(vec);
}

/** Encode a 32-byte array as scvBytes (for Soroban BytesN<32>) */
export function bytesN32ToScVal(bytes: Uint8Array | number[]): xdr.ScVal {
  const buf = Buffer.from(bytes);
  return xdr.ScVal.scvBytes(buf);
}

function debugWrap<T>(fnName: string, val: xdr.ScVal, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    console.error(`[DEBUG SCVAL] Error in ${fnName}:`, err);
    try {
      if (val && typeof val.switch === "function") {
        console.error(`[DEBUG SCVAL] Val switch name:`, val.switch().name);
        console.error(`[DEBUG SCVAL] Val JSON:`, JSON.stringify(val));
      } else {
        console.error(`[DEBUG SCVAL] Val is not a valid ScVal:`, val);
      }
    } catch (e) {
      console.error(`[DEBUG SCVAL] Failed to print val details:`, e);
    }
    throw err;
  }
}

export function scValToU32(val: xdr.ScVal): number {
  return debugWrap("scValToU32", val, () => {
    if (val.switch().name === "scvU32") {
      return Number(val.u32());
    }
    if (val.switch().name === "scvU64") {
      return Number(val.u64().toString());
    }
    throw new Error(`Expected u32/u64, got ${val.switch().name}`);
  });
}

export function scValToU64(val: xdr.ScVal): number {
  return debugWrap("scValToU64", val, () => {
    if (val.switch().name === "scvU64") {
      return Number(val.u64().toString());
    }
    if (val.switch().name === "scvU32") {
      return Number(val.u32());
    }
    throw new Error(`Expected u64, got ${val.switch().name}`);
  });
}

export function scValToBool(val: xdr.ScVal): boolean {
  return debugWrap("scValToBool", val, () => {
    if (val.switch().name === "scvBool") {
      return val.b();
    }
    throw new Error(`Expected bool, got ${val.switch().name}`);
  });
}

export function scValToString(val: xdr.ScVal): string {
  return debugWrap("scValToString", val, () => {
    if (val.switch().name === "scvString") {
      return val.str().toString();
    }
    if (val.switch().name === "scvSymbol") {
      return val.sym().toString();
    }
    if (val.switch().name === "scvVec") {
      const vec = val.vec();
      if (vec && vec.length > 0) {
        const first = vec[0];
        if (first.switch().name === "scvSymbol") {
          return first.sym().toString();
        }
        if (first.switch().name === "scvString") {
          return first.str().toString();
        }
      }
    }
    throw new Error(`Expected string, got ${val.switch().name}`);
  });
}

export function scValToAddress(val: xdr.ScVal): string {
  return debugWrap("scValToAddress", val, () => {
    if (val.switch().name === "scvAddress") {
      return Address.fromScAddress(val.address()).toString();
    }
    throw new Error(`Expected address, got ${val.switch().name}`);
  });
}

export function scValToVecU8(val: xdr.ScVal): number[] {
  return debugWrap("scValToVecU8", val, () => {
    if (val.switch().name === "scvVec") {
      return val.vec()!.map((v) => scValToU32(v));
    }
    throw new Error(`Expected vec, got ${val.switch().name}`);
  });
}

// SEP-24 Anchor integration for INR on/off ramp
export function getSep24Url(): string {
  return process.env.NEXT_PUBLIC_ANCHOR_SEP24_URL || "";
}

export async function initiateSep24Deposit(
  publicKey: string,
  amount: string
): Promise<string> {
  const sep24Url = getSep24Url();
  if (!sep24Url) throw new Error("SEP-24 anchor URL not configured");

  // Step 1: Request SEP-10 challenge XDR from proxy
  const challengeRes = await fetch("/api/sep24", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "get_challenge",
      account: publicKey,
    }),
  });

  if (!challengeRes.ok) {
    const data = await challengeRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch challenge: ${challengeRes.statusText}`);
  }

  const { transaction } = await challengeRes.json();

  // Step 2: Sign the challenge transaction
  const networkPassphrase = getNetworkPassphrase();
  let signedTxXdr = "";
  if (MOCK_KEYPAIR && publicKey === MOCK_ADDRESS) {
    const tx = TransactionBuilder.fromXDR(transaction, networkPassphrase);
    tx.sign(MOCK_KEYPAIR);
    signedTxXdr = tx.toXDR();
  } else {
    const res = await signFreighterTransaction(transaction, { networkPassphrase });
    signedTxXdr = res.signedTxXdr;
  }

  // Step 3: Submit signed challenge to proxy to perform token exchange & get interactive URL
  const submitRes = await fetch("/api/sep24", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit_signed_challenge",
      transaction: signedTxXdr,
      type: "deposit",
      amount,
      account: publicKey,
    }),
  });

  if (!submitRes.ok) {
    const data = await submitRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to submit challenge: ${submitRes.statusText}`);
  }

  const data = await submitRes.json();
  return data.url || data.attributes?.interactive_customer_info_needed?.url;
}

export async function initiateSep24Withdraw(
  publicKey: string,
  amount: string
): Promise<string> {
  const sep24Url = getSep24Url();
  if (!sep24Url) throw new Error("SEP-24 anchor URL not configured");

  // Step 1: Request SEP-10 challenge XDR from proxy
  const challengeRes = await fetch("/api/sep24", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "get_challenge",
      account: publicKey,
    }),
  });

  if (!challengeRes.ok) {
    const data = await challengeRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch challenge: ${challengeRes.statusText}`);
  }

  const { transaction } = await challengeRes.json();

  // Step 2: Sign the challenge transaction
  const networkPassphrase = getNetworkPassphrase();
  let signedTxXdr = "";
  if (MOCK_KEYPAIR && publicKey === MOCK_ADDRESS) {
    const tx = TransactionBuilder.fromXDR(transaction, networkPassphrase);
    tx.sign(MOCK_KEYPAIR);
    signedTxXdr = tx.toXDR();
  } else {
    const res = await signFreighterTransaction(transaction, { networkPassphrase });
    signedTxXdr = res.signedTxXdr;
  }

  // Step 3: Submit signed challenge to proxy to perform token exchange & get interactive URL
  const submitRes = await fetch("/api/sep24", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit_signed_challenge",
      transaction: signedTxXdr,
      type: "withdraw",
      amount,
      account: publicKey,
    }),
  });

  if (!submitRes.ok) {
    const data = await submitRes.json().catch(() => ({}));
    throw new Error(data.error || `Failed to submit challenge: ${submitRes.statusText}`);
  }

  const data = await submitRes.json();
  return data.url || data.attributes?.interactive_customer_info_needed?.url;
}

export async function addUsdcTrustline(): Promise<void> {
  const publicKey = activeAddress;
  if (!publicKey) throw new Error("Wallet not connected");

  const server = getRpcServer();
  const account = await server.getAccount(publicKey);
  const networkPassphrase = getNetworkPassphrase();

  const usdcIssuer =
    process.env.NEXT_PUBLIC_USDC_ISSUER ||
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  const asset = new Asset("USDC", usdcIssuer);

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build();

  await signAndSendTransaction(tx.toXDR());
}

export const SUPPORTED_WALLETS = [
  { id: FREIGHTER_ID, name: "Freighter", icon: "🦡" },
];
