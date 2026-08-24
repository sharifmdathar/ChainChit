import { Contract, TransactionBuilder, Address, rpc, xdr } from "@stellar/stellar-sdk";

const PASS = "Test SDF Network ; September 2015";
const ADMIN = "GBGNU4UDGPA4SESSQUVHYVGWK5HAPNHF7PTDQWLQM3QNU5ZITNM2TMAN";
const GROUPS = [
  "CDNY2GLH4KVN2U3HFWR7KL3QLPLKGSZHPODLEFFUFBXFYH46PTZQSBMY",
  "CDHPHEBPIR4ZKJFGVCZNRU6HQWRS45V72FXAPLPRDLK3K7BLESAUHXMU",
];
const soroban = new rpc.Server("https://soroban-testnet.stellar.org");

type Entry = { key: () => xdr.ScVal; val: () => xdr.ScVal };

async function call(groupId: string, method: string, args: xdr.ScVal[] = []): Promise<xdr.ScVal | undefined> {
  const acc = await soroban.getAccount(ADMIN);
  const tx = new TransactionBuilder(acc, { fee: "100000", networkPassphrase: PASS })
    .addOperation(new Contract(groupId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  return sim.result?.retval;
}

function sym(e: Entry): string {
  try { return e.key().sym()?.toString() ?? ""; } catch { return ""; }
}

function addrOf(v: xdr.ScVal | undefined): string {
  if (!v) return "";
  try { return Address.fromScVal(v).toString(); } catch {}
  return "";
}

function numOf(v: xdr.ScVal | undefined): number {
  if (!v) return 0;
  try { const n = v.u32(); if (typeof n === "number") return n; } catch {}
  try { const u = v.u64(); if (u) return Number(u.toString()); } catch {}
  try { const i = v.i128(); if (i) { const lo = i.lo().toString(); const hi = i.hi().toString(); return hi === "0" ? Number(lo) : Number(BigInt(hi) << BigInt(64) | BigInt(lo)); } } catch {}
  return 0;
}

function mapEntries(v: xdr.ScVal | undefined): Entry[] | undefined {
  try { return (v?.map?.() ?? undefined) as Entry[] | undefined; } catch { return undefined; }
}

function get(map: Entry[] | undefined, name: string): xdr.ScVal | undefined {
  return map?.find((e) => sym(e) === name)?.val();
}

async function main() {
  for (const g of GROUPS) {
    const info = mapEntries(await call(g, "get_group_info"));
    const state = (() => {
      const sv = get(info, "state");
      if (!sv) return "?";
      try { const v = sv.vec?.(); if (v) { for (const part of v) { try { const s2 = part.str()?.toString(); if (s2) return s2; } catch {} } } } catch {}
      try { return sv.str()?.toString() ?? "?"; } catch {}
      return sw(sv);
    })();
    const cycle = numOf(get(info, "current_cycle"));
    console.log(`\n=== ${g}\nstate=${state} current_cycle=${cycle}/${numOf(get(info, "total_cycles"))} members=${numOf(get(info, "num_members"))}`);
    for (let c = 1; c <= Math.max(cycle, 1); c++) {
      const cs = mapEntries(await call(g, "get_cycle_state", [xdr.ScVal.scvU32(c)]));
      const wv = get(cs, "winner");
      let winner = "-";
      if (wv) {
        winner = addrOf(wv);
        if (!winner) { try { const opt = wv.vec?.(); if (opt && opt.length) winner = addrOf(opt[0]); } catch {} }
      }
      void xdr;
      const bid = numOf(get(cs, "winning_bid"));
      const paid = Object.keys((get(cs, "payments") as any)?.value ?? {}).length;
      console.log(`  cycle ${c}: winner=${winner} winning_bid=${(bid / 1e7).toFixed(2)} USDC`);
      void paid;
    }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });

function sw(v: any): string { try { return v?.switch?.()?.name ?? "?"; } catch { return "?"; } }
