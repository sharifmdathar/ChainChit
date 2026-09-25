// Pool-asset helpers. ChainChit groups can run on either USDC (a Stellar
// asset contract) or native XLM (the Soroban "native" token contract). The
// contract itself is asset-agnostic — it just stores `token: Address` and
// calls the standard token interface — so this module only drives selection
// and display on the frontend.

export const NATIVE_TOKEN_ADDRESS =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

export type PoolAsset = "USDC" | "XLM";

/** Which pool asset a stored token address refers to (defaults to USDC). */
export function assetOf(token: string | undefined | null): PoolAsset {
  return token && token.toUpperCase() === NATIVE_TOKEN_ADDRESS ? "XLM" : "USDC";
}

export function assetSymbol(token: string | undefined | null): string {
  return assetOf(token);
}

/** Format base units (7 decimals) using the correct symbol for the asset. */
export function formatAmount(baseUnits: number, token: string | undefined | null): string {
  const value = baseUnits / 10_000_000;
  if (assetOf(token) === "XLM") {
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7,
      }).format(value) + " XLM"
    );
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}
