#!/usr/bin/env bash
# seed_lifecycle.sh — advance the seeded /discover groups into a lively mix of
# real on-chain states so the cards are not all "Forming · 0 members · cycle 0".
#
#   * creates 6 reusable, friendbot-funded member identities (seed1..seed6)
#   * joins members to hit target fill levels
#   * start_collection on the FULL groups            -> COLLECTING (cycle 1)
#   * tiny window + deadline + begin_bidding on two  -> BIDDING    (cycle 1)
#
# Signs member joins with each member identity; admin ops with `freighter`.
# Usage (repo root):
#   ADMIN_G=GBGN... bash scripts/seed_lifecycle.sh
set -uo pipefail

RPC="${RPC:-https://soroban-testnet.stellar.org}"
NP="${NP:-Test SDF Network ; September 2015}"
ADMIN="${ADMIN_G:?set ADMIN_G to the freighter public key (G...)}"

# group contract ids (registry order)
G0=CAJOFYG62ZT5JOU3COBJ2I7CQKQHTHXBCHW56LHPX7CZMQLAIL7Q6TSR  # $2 x3
G1=CCYLIJVZWM6XJSGH3G7XO2RLCT6EDCBFC6XCI2DRRVY2UVBJBNBWQNMV  # $2 x3
G2=CDYSMCWWCKCR6RNESZESTHREFCBHVHQM4MJUNI2AQNWEE6SNGYEDCKHX  # $10 x5
G3=CBNBTBIIC5FTGXTLSQABXTCQHUD3MQ3UHG4UQM56Q2JJFM7KYU4I5H2V  # $25 x8
G4=CBK5GZSIGXTKZPWDK6ZEMDF7ZAUFSIGDPO5PKUAC2RL27PNE5F5WE5JX  # $50 x6
G5=CBIMENZPODDQEG6DBRWI5NMU5RMKAOX6FDJQWDBSLDHOA5RHZI36EM4O  # $100 x10
G6=CAHQ5NHN7XZFMJQJFSNGO5MPJEPQ22CSWN5WUA42HJ5CXPDTBPYNO27L  # $15 x4

invoke() {  # invoke <source> <contract> <fn-and-args...>
  local src="$1"; shift
  local id="$1"; shift
  stellar contract invoke --id "$id" --source "$src" \
    --rpc-url "$RPC" --network-passphrase "$NP" -- "$@" >/dev/null 2>&1
}

# 1) create + fund 6 member identities (recreate cleanly each run)
declare -a ADDR
for i in 1 2 3 4 5 6; do
  stellar keys rm "seed$i" >/dev/null 2>&1 || true
  stellar keys generate "seed$i" >/dev/null 2>&1
  ADDR[i]="$(stellar keys address "seed$i" 2>/dev/null)"
  node -e 'fetch("https://friendbot.stellar.org?addr="+process.argv[1]).then(r=>r.json()).then(j=>console.log("funded",!!j.hash)).catch(e=>console.error("fund-err",e.message))' "${ADDR[i]}"
  echo "member seed$i = ${ADDR[i]}"
  sleep 2
done

join() {  # join <group> <memberIndex>
  invoke "seed$2" "$1" join_group --caller "${ADDR[$2]}"
}

echo "→ joining members…"
join "$G0" 1; join "$G0" 2; join "$G0" 3
join "$G1" 1; join "$G1" 2; join "$G1" 3
join "$G2" 1; join "$G2" 2; join "$G2" 3
join "$G3" 1; join "$G3" 2; join "$G3" 3; join "$G3" 4; join "$G3" 5
join "$G4" 1; join "$G4" 2; join "$G4" 3; join "$G4" 4; join "$G4" 5; join "$G4" 6
join "$G5" 1; join "$G5" 2; join "$G5" 3; join "$G5" 4
join "$G6" 1; join "$G6" 2; join "$G6" 3; join "$G6" 4

echo "→ starting collection (full groups)…"
invoke freighter "$G0" start_collection --caller "$ADMIN"
invoke freighter "$G4" start_collection --caller "$ADMIN"

echo "→ arming Bidding on G1 and G6 (tiny window, then deadline elapses)…"
invoke freighter "$G1" set_collection_window --caller "$ADMIN" --window 3
invoke freighter "$G1" start_collection --caller "$ADMIN"
invoke freighter "$G6" set_collection_window --caller "$ADMIN" --window 3
invoke freighter "$G6" start_collection --caller "$ADMIN"
sleep 8
invoke freighter "$G1" begin_bidding_after_deadline
invoke freighter "$G6" begin_bidding_after_deadline

echo
echo "Done. Target states:"
echo "  G0 \$2x3  COLLECTING 1/3  3/3"
echo "  G1 \$2x3  BIDDING    1/3  3/3"
echo "  G2 \$10x5 FORMING          3/5"
echo "  G3 \$25x8 FORMING          5/8"
echo "  G4 \$50x6 COLLECTING 1/6  6/6"
echo "  G5 \$100x10 FORMING        4/10"
echo "  G6 \$15x4 BIDDING    1/4  4/4"
