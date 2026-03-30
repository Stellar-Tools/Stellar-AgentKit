# Swap Router Design Spec

## Overview

Add a multi-DEX swap router to Stellar AgentKit that finds optimal multi-hop trade routes across all major Stellar liquidity sources: Soroswap, Phoenix DEX, Stellar SDEX, and other Soroban AMMs. Mainnet support included.

## Motivation

Currently, swaps go through a single hardcoded Soroban contract with no routing. This means users get suboptimal rates — they can't discover better prices on other DEXes or benefit from multi-hop paths (e.g., A -> XLM -> B) that yield better output.

## Goals

- Find the best swap route across all Stellar DEXes
- Support multi-hop routes (up to 3 hops)
- Backward compatible API — existing `swap()` calls work unchanged
- Mainnet and testnet support
- Pluggable DEX adapter architecture for easy extension

## Non-Goals

- Split routing (splitting trades across multiple pools simultaneously)
- Off-chain aggregator service
- Limit orders or advanced order types

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              AgentClient.swap()              │
│         strategy: "direct" | "best-route"    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│                 SwapRouter                   │
│  - buildTokenGraph()                         │
│  - findBestRoute(tokenA, tokenB, amount)     │
│  - executeRoute(route)                       │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┬───────────┐
        ▼          ▼          ▼           ▼
   ┌─────────┐ ┌────────┐ ┌───────┐ ┌─────────┐
   │Soroswap │ │ Phoenix│ │ SDEX  │ │ Future  │
   │Adapter  │ │Adapter │ │Adapter│ │Adapters │
   └─────────┘ └────────┘ └───────┘ └─────────┘
        │          │          │           │
        ▼          ▼          ▼           ▼
   ┌─────────────────────────────────────────┐
   │           Pool Registry (Cache)          │
   │  - pools: Pool[]                         │
   │  - refreshInterval: number               │
   │  - lastUpdated: number                   │
   └─────────────────────────────────────────┘
```

### Components

#### 1. DexAdapter Interface

Every DEX integration implements this interface:

```typescript
interface DexAdapter {
  name: string;

  // Pool discovery — results are cached by the registry
  discoverPools(): Promise<Pool[]>;

  // Live quote for a specific pool at swap time
  getQuote(pool: Pool, tokenIn: string, amountIn: bigint): Promise<Quote>;

  // Build the Soroban/Classic operation for this swap leg
  buildSwapOp(
    pool: Pool,
    tokenIn: string,
    amountIn: bigint,
    minOut: bigint
  ): Promise<xdr.Operation>;
}
```

#### 2. Pool & Quote Types

```typescript
interface Pool {
  id: string;
  dex: string;                // adapter name
  tokenA: string;             // contract address or "native" for XLM
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  fee: number;                // e.g., 0.003 for 0.3%
  contractAddress?: string;   // Soroban pool contract
  lastUpdated: number;        // timestamp ms
}

interface Quote {
  amountOut: bigint;
  priceImpact: number;        // percentage, e.g., 0.5 = 0.5%
  fee: bigint;
}

interface Route {
  path: RouteLeg[];
  totalAmountOut: bigint;
  totalPriceImpact: number;
  totalFees: bigint;
}

interface RouteLeg {
  pool: Pool;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  expectedAmountOut: bigint;
}
```

#### 3. Pool Registry

Hybrid caching strategy:

- **Discovery cache:** Pool list refreshed every 5 minutes (configurable). Stored in-memory.
- **Live reserves:** Fetched at swap time for pools on candidate routes only.
- **Cache invalidation:** On network change (testnet <-> mainnet), clear entire cache.

```typescript
class PoolRegistry {
  private pools: Pool[] = [];
  private adapters: DexAdapter[];
  private refreshInterval: number;    // default 5 min
  private lastRefresh: number = 0;

  async getPools(): Promise<Pool[]>;           // returns cached, refreshes if stale
  async refreshLiveReserves(pools: Pool[]): Promise<Pool[]>;  // fetch live data
  registerAdapter(adapter: DexAdapter): void;
}
```

#### 4. SwapRouter

Core routing engine:

```typescript
class SwapRouter {
  private registry: PoolRegistry;

  // Build directed graph: tokens = nodes, pools = edges
  // Edge weight = -log(effectiveRate) for Dijkstra optimization
  private buildTokenGraph(pools: Pool[]): TokenGraph;

  // Find best route with up to maxHops (default 3)
  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    maxHops?: number
  ): Promise<Route>;

  // Execute a route: build + sign + submit each leg sequentially
  async executeRoute(
    route: Route,
    slippage: number,
    signerSecret: string
  ): Promise<string>;  // returns final tx hash
}
```

**Pathfinding algorithm:**
1. Get all pools from registry (cached)
2. Build token graph with edges weighted by `-log(effectiveRate)`
3. Run modified Dijkstra to find shortest path (= best output) with hop limit
4. For candidate route: fetch live reserves for involved pools
5. Re-calculate with live data to get accurate quote
6. Apply slippage tolerance to each leg's minOut
7. Execute legs sequentially

#### 5. DEX Adapter Implementations

**SoroswapAdapter:**
- Query Soroswap factory contract to discover all pairs
- Use pair contracts for quotes (getAmountOut)
- Build Soroban invoke operations for swaps
- Mainnet factory: query Soroswap's deployed factory address
- Testnet factory: use known testnet deployment

**PhoenixAdapter:**
- Query Phoenix factory for registered pools
- Use Phoenix pool contracts for quotes
- Build Soroban invoke operations
- Handle Phoenix's specific fee structure

**SdexAdapter:**
- Use Stellar Horizon API to query order book
- Use `pathPaymentStrictSend` / `pathPaymentStrictReceive` for execution
- No Soroban contract needed — Classic operations
- Query `/order_book?selling_asset_type=...&buying_asset_type=...`

**Future adapters** follow the same pattern — implement `DexAdapter` and register with the pool registry.

---

## API Changes

### New Routed Swap (opt-in)

```typescript
await agent.swap({
  tokenIn: "USDC:GA5ZSE...",   // asset in "code:issuer" format, or "native" for XLM
  tokenOut: "XLM",
  amount: "100",                // amount of tokenIn to swap
  slippage: 0.5,                // max slippage percentage
  strategy: "best-route",
  maxHops: 3                    // optional, default 3
});
```

Returns:
```typescript
interface SwapResult {
  txHash: string;
  route: {
    path: string[];             // token addresses in order
    dexes: string[];            // DEX used for each leg
    amountIn: string;
    amountOut: string;
    priceImpact: number;
  };
}
```

### Existing Direct Swap (unchanged)

```typescript
// This continues to work exactly as before
await agent.swap({ to, buyA, out, inMax });
```

The `strategy` parameter defaults to `"direct"`, preserving backward compatibility. When `strategy` is absent or `"direct"`, the existing single-contract swap path is used.

### Route Preview

```typescript
// Get route without executing
const route = await agent.getSwapRoute({
  tokenIn: "native",
  tokenOut: "USDC:GA5ZSE...",
  amount: "1000",
  maxHops: 3
});
// Returns: Route object with path, expected output, price impact, fees
```

---

## File Structure

```
src/
├── router/
│   ├── index.ts              # SwapRouter class
│   ├── types.ts              # Pool, Quote, Route, RouteLeg, DexAdapter interfaces
│   ├── registry.ts           # PoolRegistry with caching
│   ├── graph.ts              # TokenGraph + Dijkstra pathfinding
│   └── adapters/
│       ├── index.ts           # Adapter registry + factory
│       ├── soroswap.ts        # SoroswapAdapter
│       ├── phoenix.ts         # PhoenixAdapter
│       └── sdex.ts            # SdexAdapter (Horizon order book)
```

Integration points:
- `agent.ts` — add `strategy` param handling in `swap()`, add `getSwapRoute()` method
- `index.ts` — export new router types and tools
- `tools/contract.ts` — add `routed_swap` action to LangChain tool

---

## Network Configuration

```typescript
// Mainnet
const MAINNET_CONFIG = {
  rpcUrl: "https://soroban.stellar.org",
  horizonUrl: "https://horizon.stellar.org",
  networkPassphrase: Networks.PUBLIC,
  soroswapFactory: "<mainnet-factory-address>",
  phoenixFactory: "<mainnet-factory-address>",
};

// Testnet
const TESTNET_CONFIG = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  soroswapFactory: "<testnet-factory-address>",
  phoenixFactory: "<testnet-factory-address>",
};
```

The router uses the `network` setting from `AgentClient` config. Mainnet swaps require `allowMainnet: true` (existing safety check).

---

## Error Handling

- **No route found:** Throw `NoRouteError` with available tokens listed
- **Slippage exceeded:** Throw `SlippageExceededError` with actual vs expected amounts
- **Adapter failure:** Log warning, exclude that DEX's pools, continue with remaining adapters
- **Stale cache:** If live reserve fetch fails, use cached data with warning
- **Multi-hop execution failure:** If a leg fails mid-route, return partial execution details with error

---

## Testing Strategy

- **Unit tests:** Each adapter's pool discovery and quoting logic with mocked RPC responses
- **Unit tests:** Graph building and Dijkstra pathfinding with known pool sets
- **Unit tests:** Router route selection with mocked adapters
- **Integration tests:** End-to-end route finding on testnet with real pools
- **Edge cases:** No liquidity, single-hop optimal, circular paths, same token in/out
