import { Operation, Asset, xdr } from "@stellar/stellar-sdk";
import type { DexAdapter, Pool, Quote, NetworkConfig } from "../types";

// Well-known SDEX trading pairs to bootstrap discovery
const KNOWN_ASSETS = [
  { code: "XLM", issuer: null, id: "native" },
  { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  { code: "yUSDC", issuer: "GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF", id: "yUSDC:GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF" },
  { code: "AQUA", issuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67TKA", id: "AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67TKA" },
  { code: "SHX", issuer: "GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEZ6BIROVFMACITZBI7HFXQBKIT", id: "SHX:GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEZ6BIROVFMACITZBI7HFXQBKIT" },
];

function parseAsset(assetStr: string): Asset {
  if (assetStr === "native") return Asset.native();
  const [code, issuer] = assetStr.split(":");
  return new Asset(code, issuer);
}

function assetToQueryParams(asset: Asset): string {
  if (asset.isNative()) return "asset_type=native";
  return `asset_type=credit_alphanum${asset.getCode().length <= 4 ? "4" : "12"}&asset_code=${asset.getCode()}&asset_issuer=${asset.getIssuer()}`;
}

export class SdexAdapter implements DexAdapter {
  name = "sdex";
  private config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  async discoverPools(): Promise<Pool[]> {
    const pools: Pool[] = [];

    for (let i = 0; i < KNOWN_ASSETS.length; i++) {
      for (let j = i + 1; j < KNOWN_ASSETS.length; j++) {
        const assetA = KNOWN_ASSETS[i];
        const assetB = KNOWN_ASSETS[j];

        try {
          const sellingAsset = parseAsset(assetA.id);
          const buyingAsset = parseAsset(assetB.id);

          const sellingParams = assetToQueryParams(sellingAsset);
          const buyingParams = assetToQueryParams(buyingAsset);

          const url = `${this.config.horizonUrl}/order_book?selling_${sellingParams}&buying_${buyingParams}&limit=1`;
          const response = await fetch(url);

          if (!response.ok) continue;

          const orderBook = await response.json();

          const bidVolume = (orderBook.bids || []).reduce(
            (sum: number, b: any) => sum + parseFloat(b.amount),
            0
          );
          const askVolume = (orderBook.asks || []).reduce(
            (sum: number, a: any) => sum + parseFloat(a.amount),
            0
          );

          if (bidVolume === 0 && askVolume === 0) continue;

          pools.push({
            id: `sdex:${assetA.code}-${assetB.code}`,
            dex: "sdex",
            tokenA: assetA.id,
            tokenB: assetB.id,
            reserveA: BigInt(Math.round(bidVolume * 10_000_000)),
            reserveB: BigInt(Math.round(askVolume * 10_000_000)),
            fee: 0,
            lastUpdated: Date.now(),
          });
        } catch (err) {
          continue;
        }
      }
    }

    return pools;
  }

  async getQuote(pool: Pool, tokenIn: string, amountIn: bigint): Promise<Quote> {
    const sourceAsset = parseAsset(tokenIn);
    const destAssetStr = tokenIn === pool.tokenA ? pool.tokenB : pool.tokenA;
    const destAsset = parseAsset(destAssetStr);

    const sourceParams = assetToQueryParams(sourceAsset);
    const destParams = assetToQueryParams(destAsset);

    const amountStr = (Number(amountIn) / 10_000_000).toFixed(7);

    const url = `${this.config.horizonUrl}/paths/strict-send?source_${sourceParams}&source_amount=${amountStr}&destination_${destParams}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { amountOut: BigInt(0), priceImpact: 0, fee: BigInt(0) };
      }

      const data = await response.json();
      const records = data._embedded?.records || [];

      if (records.length === 0) {
        return { amountOut: BigInt(0), priceImpact: 0, fee: BigInt(0) };
      }

      const best = records[0];
      const amountOut = BigInt(Math.round(parseFloat(best.destination_amount) * 10_000_000));

      const reserveIn = tokenIn === pool.tokenA ? pool.reserveA : pool.reserveB;
      const reserveOut = tokenIn === pool.tokenA ? pool.reserveB : pool.reserveA;
      const spotPrice =
        reserveIn > BigInt(0) ? Number(reserveOut) / Number(reserveIn) : 0;
      const executionPrice =
        amountIn > BigInt(0) ? Number(amountOut) / Number(amountIn) : 0;
      const priceImpact =
        spotPrice > 0
          ? Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100)
          : 0;

      return { amountOut, priceImpact, fee: BigInt(0) };
    } catch (err) {
      return { amountOut: BigInt(0), priceImpact: 0, fee: BigInt(0) };
    }
  }

  async buildSwapOp(
    pool: Pool,
    tokenIn: string,
    amountIn: bigint,
    minOut: bigint
  ): Promise<xdr.Operation> {
    const sourceAsset = parseAsset(tokenIn);
    const destAssetStr = tokenIn === pool.tokenA ? pool.tokenB : pool.tokenA;
    const destAsset = parseAsset(destAssetStr);

    const sendAmount = (Number(amountIn) / 10_000_000).toFixed(7);
    const destMin = (Number(minOut) / 10_000_000).toFixed(7);

    // Use pathPaymentStrictSend for SDEX swaps
    const op = Operation.pathPaymentStrictSend({
      sendAsset: sourceAsset,
      sendAmount: sendAmount,
      destination: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", // placeholder, set by router
      destAsset: destAsset,
      destMin: destMin,
      path: [],
    });

    return op;
  }
}
