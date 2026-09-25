#!/usr/bin/env bash
# seed_discover.sh — create a handful of REAL example chit groups through the
# factory so the /discover page has varied, joinable data (different pool sizes,
# member counts and contribution amounts). Signs with the `freighter` CLI
# identity; each group's admin/first member is $CALLER.
#
# Usage (repo root):
#   NEW_FACTORY=CAJ2... ADMIN_G=GBGN... bash scripts/seed_discover.sh
set -euo pipefail

RPC="${RPC:-https://soroban-testnet.stellar.org}"
NP="${NP:-Test SDF Network ; September 2015}"
SRC="${SRC:-freighter}"
FACTORY="${NEW_FACTORY:-CAJ2B2GFN4MGZYCLTIBWNRJIGJJCR34G4E2OAHGL5M6S4UB4IZA7GRVY}"
CALLER="${ADMIN_G:?set ADMIN_G to the freighter public key (G...)}"
TOKEN="${TOKEN:-CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA}"

# contribution is in base units (x 1e7): 50000000 = $5.00
mk() {
  local contrib="$1" members="$2" cycles="$3" label="$4"
  local salt="$(openssl rand -hex 32)"   # stellar-cli v28 wants BytesN WITHOUT a 0x prefix
  echo "→ creating: ${label}  (pool base=${contrib} x ${members} members, ${cycles} cycles)"
  stellar contract invoke --id "$FACTORY" --source "$SRC" \
    --rpc-url "$RPC" --network-passphrase "$NP" \
    -- create_group \
       --caller "$CALLER" \
       --salt "$salt" \
       --token "$TOKEN" \
       --contribution_amount "$contrib" \
       --num_members "$members" \
       --total_cycles "$cycles" \
       --min_attestation_score 0 \
       --min_reputation_for_bid 0 >/dev/null
  sleep 2
}

mk  20000000 3  3   "Starter · \$2 x 3"
mk 100000000 5  5   "Neighbourhood · \$10 x 5"
mk 250000000 8  8   "Savers Circle · \$25 x 8"
mk 500000000 6  6   "Market Traders · \$50 x 6"
mk 1000000000 10 10  "Business Fund · \$100 x 10"
mk 150000000 4  12  "Quarterly · \$15 x 4, 12 cycles"

echo
echo "Done. Run this to confirm the registry count:"
echo "  stellar contract invoke --id \"$FACTORY\" --source $SRC --rpc-url $RPC --network-passphrase \"$NP\" -- get_group_count"
