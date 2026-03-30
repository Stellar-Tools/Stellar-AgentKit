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

export class PhoenixAdapter implements DexAdapter {
  name = "phoenix";
  private config: NetworkConfig;
  private server: rpc.Server;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: true });
  }

  async discoverPools(): Promise<Pool[]> {
    const pools: Pool[] = [];
    const factory = new Contract(this.config.phoenixFactory);

    try {
      const poolAddresses = await this.callReadOnly(factory, "query_pools", []);

      if (!Array.isArray(poolAddresses)) return pools;

      for (const addr of poolAddresses) {
        try {
          const poolContract = new Contract(String(addr));
          const poolInfo = await this.callReadOnly(poolContract, "query_pool_info", []);

          if (!poolInfo) continue;

          const tokenA = poolInfo.asset_a?.address || poolInfo.asset_a;
          const tokenB = poolInfo.asset_b?.address || poolInfo.asset_b;
          const reserveA = BigInt(poolInfo.reserve_a || poolInfo.pool_response?.asset_a?.amount || 0);
          const reserveB = BigInt(poolInfo.reserve_b || poolInfo.pool_response?.asset_b?.amount || 0);
          const fee = poolInfo.fee_rate ? Number(poolInfo.fee_rate) / 10000 : 0.003;

          pools.push({
            id: `phoenix:${String(addr)}`,
            dex: "phoenix",
            tokenA: String(tokenA),
            tokenB: String(tokenB),
            reserveA,
            reserveB,
            fee,
            contractAddress: String(addr),
            lastUpdated: Date.now(),
          });
        } catch (err) {
          console.warn(`Phoenix: failed to load pool ${addr}:`, err);
        }
      }
    } catch (err) {
      console.warn("Phoenix: failed to query factory:", err);
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
    const priceImpact = spotPrice > 0 ? Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100) : 0;

    return { amountOut, priceImpact, fee: feeAmount };
  }

  async buildSwapOp(
    pool: Pool,
    tokenIn: string,
    amountIn: bigint,
    minOut: bigint
  ): Promise<xdr.Operation> {
    if (!pool.contractAddress) {
      throw new Error(`Phoenix pool ${pool.id} has no contract address`);
    }

    const poolContract = new Contract(pool.contractAddress);

    const op = poolContract.call(
      "swap",
      nativeToScVal(new Address(pool.contractAddress), { type: "address" }),
      nativeToScVal(new Address(tokenIn), { type: "address" }),
      nativeToScVal(amountIn, { type: "i128" }),
      nativeToScVal(minOut, { type: "i128" }),
      nativeToScVal(BigInt(100), { type: "i128" })
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
