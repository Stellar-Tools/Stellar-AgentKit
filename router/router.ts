import { rpc, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk";
import type { DexAdapter, Pool, Quote, Route, NetworkConfig } from "./types";
import { PoolRegistry } from "./registry";
import { TokenGraph } from "./graph";
import { signTransaction } from "../lib/stellar";

export class SwapRouter {
  private registry: PoolRegistry;
  private config: NetworkConfig;
  private server: rpc.Server;

  constructor(config: NetworkConfig, refreshIntervalMs: number = 300000) {
    this.config = config;
    this.registry = new PoolRegistry({ refreshIntervalMs });
    this.server = new rpc.Server(config.rpcUrl, { allowHttp: true });
  }

  registerAdapter(adapter: DexAdapter): void {
    this.registry.registerAdapter(adapter);
  }

  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    maxHops: number = 3
  ): Promise<Route | null> {
    const pools = await this.registry.getPools();

    if (pools.length === 0) return null;

    const graph = new TokenGraph();
    graph.buildFromPools(pools);

    const route = graph.findBestRoute(tokenIn, tokenOut, amountIn, maxHops);

    return route;
  }

  async executeRoute(
    route: Route,
    slippage: number,
    callerPublicKey: string
  ): Promise<string> {
    let lastTxHash = "";

    for (const leg of route.path) {
      const adapter = this.registry.getAdapter(leg.pool.dex);
      if (!adapter) {
        throw new Error(`No adapter found for DEX: ${leg.pool.dex}`);
      }

      const slippageMultiplier = 1 - slippage / 100;
      const minOut = BigInt(
        Math.floor(Number(leg.expectedAmountOut) * slippageMultiplier)
      );

      const op = await adapter.buildSwapOp(
        leg.pool,
        leg.tokenIn,
        leg.amountIn,
        minOut
      );

      const sourceAccount = await this.server.getAccount(callerPublicKey);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(300)
        .build();

      const preparedTx = await this.server.prepareTransaction(tx);
      const signedXDR = signTransaction(
        preparedTx.toXDR(),
        this.config.networkPassphrase
      );

      const signedTx = TransactionBuilder.fromXDR(
        signedXDR,
        this.config.networkPassphrase
      );
      const result = await this.server.sendTransaction(signedTx);

      let response = await this.server.getTransaction(result.hash);
      let retries = 0;
      while (response.status === "NOT_FOUND" && retries < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        response = await this.server.getTransaction(result.hash);
        retries++;
      }

      if (response.status !== "SUCCESS") {
        throw new Error(
          `Route leg failed (${leg.pool.dex} ${leg.tokenIn}->${leg.tokenOut}): ${response.status}`
        );
      }

      lastTxHash = result.hash;
    }

    return lastTxHash;
  }

  clearCache(): void {
    this.registry.clearCache();
  }
}
