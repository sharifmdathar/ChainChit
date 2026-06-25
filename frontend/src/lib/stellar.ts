import {
  StellarWalletsKit,
  FREIGHTER_ID,
  WalletNetwork,
  FreighterModule,
} from "@creit.tech/stellar-wallets-kit";
import { Address, Keypair, TransactionBuilder, SorobanRpc, Contract, xdr } from "@stellar/stellar-sdk";

let kit: StellarWalletsKit | null = null;
let activeAddress: string | null = null;

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

export function getRpcServer(): SorobanRpc.Server {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://rpc.stellar.org";
  return new SorobanRpc.Server(rpcUrl, { allowHttp: false });
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

export async function connectWallet(walletId: string = FREIGHTER_ID): Promise<string> {
  const k = getKit();
  k.setWallet(walletId);

  const { address } = await k.getAddress();
  if (!address) throw new Error("No address returned from wallet");
  activeAddress = address;
  return address;
}

export async function disconnectWallet(): Promise<void> {
  kit = null;
  activeAddress = null;
}

export async function getPublicKey(): Promise<string | null> {
  if (activeAddress) return activeAddress;
  try {
    const k = getKit();
    const { address } = await k.getAddress();
    activeAddress = address || null;
    return activeAddress;
  } catch {
    return null;
  }
}

export async function signAndSendTransaction(
  txXdr: string
): Promise<SorobanRpc.Api.SendTransactionResponse> {
  const k = getKit();
  const networkPassphrase = getNetworkPassphrase();

  const { signedTxXdr } = await k.signTransaction(txXdr, {
    networkPassphrase,
  });

  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
  const sendResponse = await server.sendTransaction(tx as any);

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
    if (!sign) {
      // Simulation fallback to admin address
      publicKey = "GDJFMVPEBMOYMYHPEHXODG4WLDSTQBD66CEDHQS7WQM7VDGGOJVSN6PR";
    } else {
      throw new Error("Wallet not connected");
    }
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

  if (SorobanRpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation error: ${simResponse.error}`);
  }

  const assembledTx = SorobanRpc.assembleTransaction(tx, simResponse).build();

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
  return xdr.ScVal.scvU64(new xdr.Uint64(BigInt(value)));
}

export function u32ToScVal(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
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

export function scValToU32(val: xdr.ScVal): number {
  if (val.switch().name === "scvU32") {
    return Number(val.u32());
  }
  if (val.switch().name === "scvU64") {
    return Number(val.u64().toString());
  }
  throw new Error(`Expected u32/u64, got ${val.switch().name}`);
}

export function scValToU64(val: xdr.ScVal): number {
  if (val.switch().name === "scvU64") {
    return Number(val.u64().toString());
  }
  if (val.switch().name === "scvU32") {
    return Number(val.u32());
  }
  throw new Error(`Expected u64, got ${val.switch().name}`);
}

export function scValToBool(val: xdr.ScVal): boolean {
  if (val.switch().name === "scvBool") {
    return val.b();
  }
  throw new Error(`Expected bool, got ${val.switch().name}`);
}

export function scValToString(val: xdr.ScVal): string {
  if (val.switch().name === "scvString") {
    return val.str().toString();
  }
  throw new Error(`Expected string, got ${val.switch().name}`);
}

export function scValToAddress(val: xdr.ScVal): string {
  if (val.switch().name === "scvAddress") {
    return val.address().toString();
  }
  throw new Error(`Expected address, got ${val.switch().name}`);
}

export function scValToVecU8(val: xdr.ScVal): number[] {
  if (val.switch().name === "scvVec") {
    return val.vec()!.map((v) => scValToU32(v));
  }
  throw new Error(`Expected vec, got ${val.switch().name}`);
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

  const params = new URLSearchParams({
    asset_code: "INR",
    asset_issuer: "",
    amount,
    account: publicKey,
  });

  const response = await fetch(
    `${sep24Url}/transactions/deposit/interactive?${params.toString()}`,
    { redirect: "manual" }
  );

  if (!response.ok) {
    throw new Error(`SEP-24 deposit initiation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.url || data.attributes?.interactive_customer_info_needed?.url;
}

export async function initiateSep24Withdraw(
  publicKey: string,
  amount: string
): Promise<string> {
  const sep24Url = getSep24Url();
  if (!sep24Url) throw new Error("SEP-24 anchor URL not configured");

  const params = new URLSearchParams({
    asset_code: "INR",
    asset_issuer: "",
    amount,
    account: publicKey,
  });

  const response = await fetch(
    `${sep24Url}/transactions/withdraw/interactive?${params.toString()}`,
    { redirect: "manual" }
  );

  if (!response.ok) {
    throw new Error(`SEP-24 withdrawal initiation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.url || data.attributes?.interactive_customer_info_needed?.url;
}

export const SUPPORTED_WALLETS = [
  { id: FREIGHTER_ID, name: "Freighter", icon: "🦡" },
];
