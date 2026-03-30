import type { DexAdapter, Pool } from "./types";

export interface PoolRegistryConfig {
  refreshIntervalMs: number;
}

export class PoolRegistry {
  private adapters: Map<string, DexAdapter> = new Map();
  private pools: Pool[] = [];
  private lastRefresh: number = 0;
  private refreshIntervalMs: number;

  constructor(config: PoolRegistryConfig = { refreshIntervalMs: 300000 }) {
    this.refreshIntervalMs = config.refreshIntervalMs;
  }

  registerAdapter(adapter: DexAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name: string): DexAdapter | undefined {
    return this.adapters.get(name);
  }

  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  async getPools(): Promise<Pool[]> {
    const now = Date.now();
    if (this.pools.length > 0 && now - this.lastRefresh < this.refreshIntervalMs) {
      return this.pools;
    }
    return this.refreshPools();
  }

  private async refreshPools(): Promise<Pool[]> {
    const allPools: Pool[] = [];

    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async (adapter) => {
        const pools = await adapter.discoverPools();
        return pools;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allPools.push(...result.value);
      } else {
        console.warn("Adapter pool discovery failed:", result.reason);
      }
    }

    this.pools = allPools;
    this.lastRefresh = Date.now();
    return this.pools;
  }

  clearCache(): void {
    this.pools = [];
    this.lastRefresh = 0;
  }
}
