import {
  Contract,
  rpc,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  TransactionBuilder,
  Account,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import type { DexAdapter, Pool, Quote, NetworkConfig } from "../types";

export class SoroswapAdapter implements DexAdapter {
  name = "soroswap";
  private config: NetworkConfig;
  private server: rpc.Server;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: true });
  }

  async discoverPools(): Promise<Pool[]> {
    const pools: Pool[] = [];
    const factory = new Contract(this.config.soroswapFactory);

    try {
      const pairCount = await this.callReadOnly(factory, "all_pairs_length", []);
      const count = typeof pairCount === "number" ? pairCount : Number(pairCount);

      for (let i = 0; i < count; i++) {
        try {
          const pairAddress = await this.callReadOnly(factory, "all_pairs", [
            nativeToScVal(i, { type: "u32" }),
          ]);

          if (!pairAddress) continue;

          const pairContract = new Contract(String(pairAddress));

          const [token0, token1, reserves] = await Promise.all([
            this.callReadOnly(pairContract, "token_0", []),
            this.callReadOnly(pairContract, "token_1", []),
            this.callReadOnly(pairContract, "get_reserves", []),
          ]);

          if (!token0 || !token1 || !reserves) continue;

          const [reserve0, reserve1] = Array.isArray(reserves)
            ? reserves
            : [BigInt(0), BigInt(0)];

          pools.push({
            id: `soroswap:${String(pairAddress)}`,
            dex: "soroswap",
            tokenA: String(token0),
            tokenB: String(token1),
            reserveA: BigInt(reserve0),
            reserveB: BigInt(reserve1),
            fee: 0.003,
            contractAddress: String(pairAddress),
            lastUpdated: Date.now(),
          });
        } catch (err) {
          console.warn(`Soroswap: failed to load pair at index ${i}:`, err);
        }
      }
    } catch (err) {
      console.warn("Soroswap: failed to query factory:", err);
    }

    return pools;
  }

  async getQuote(pool: Pool, tokenIn: string, amountIn: bigint): Promise<Quote> {
    const isTokenA = tokenIn === pool.tokenA;
    const reserveIn = isTokenA ? pool.reserveA : pool.reserveB;
    const reserveOut = isTokenA ? pool.reserveB : pool.reserveA;

    const FEE_PRECISION = BigInt(1000);
    const feeNumerator = BigInt(Math.round(pool.fee * 1000));
    const amountInWithFee = amountIn * (FEE_PRECISION - feeNumerator);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * FEE_PRECISION + amountInWithFee;

    const amountOut = denominator > BigInt(0) ? numerator / denominator : BigInt(0);
    const feeAmount = (amountIn * feeNumerator) / FEE_PRECISION;

    const spotPrice = Number(reserveOut) / Number(reserveIn);
    const executionPrice = amountIn > BigInt(0) ? Number(amountOut) / Number(amountIn) : 0;
    const priceImpact =
      spotPrice > 0 ? Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100) : 0;

    return { amountOut, priceImpact, fee: feeAmount };
  }

  async buildSwapOp(
    pool: Pool,
    tokenIn: string,
    amountIn: bigint,
    minOut: bigint
  ): Promise<xdr.Operation> {
    if (!pool.contractAddress) {
      throw new Error(`Soroswap pool ${pool.id} has no contract address`);
    }

    const pairContract = new Contract(pool.contractAddress);
    const isTokenA = tokenIn === pool.tokenA;

    const amount0Out = isTokenA
      ? nativeToScVal(BigInt(0), { type: "i128" })
      : nativeToScVal(minOut, { type: "i128" });
    const amount1Out = isTokenA
      ? nativeToScVal(minOut, { type: "i128" })
      : nativeToScVal(BigInt(0), { type: "i128" });

    const op = pairContract.call(
      "swap",
      amount0Out,
      amount1Out,
      nativeToScVal(new Address(pool.contractAddress), { type: "address" })
    );

    return op;
  }

  private async callReadOnly(
    contract: Contract,
    method: string,
    args: xdr.ScVal[]
  ): Promise<any> {
    const sourceAccount = new Account(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      "0"
    );

    const builder = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    });

    if (args.length > 0) {
      builder.addOperation(contract.call(method, ...args));
    } else {
      builder.addOperation(contract.call(method));
    }

    const tx = builder.setTimeout(30).build();
    const sim = await this.server.simulateTransaction(tx);

    if ("results" in sim && Array.isArray(sim.results) && sim.results.length > 0) {
      const result = sim.results[0];
      if (result.xdr) {
        const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
        return scValToNative(scVal);
      }
    }

    if ("error" in sim) {
      throw new Error(`Simulation error for ${method}: ${sim.error}`);
    }

    return null;
  }
}
