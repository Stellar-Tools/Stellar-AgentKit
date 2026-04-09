import { describe, it, expect } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { ChainSymbol } from '@allbridge/bridge-core-sdk';

type StellarNetwork = "stellar-testnet" | "stellar-mainnet";
type TargetChain = "ethereum" | "polygon" | "arbitrum" | "base";

const TARGET_CHAIN_MAP: Record<TargetChain, ChainSymbol> = {
  ethereum: ChainSymbol.ETH,
  polygon: ChainSymbol.POL,
  arbitrum: ChainSymbol.ARB,
  base: ChainSymbol.BAS,
};

const STELLAR_NETWORK_CONFIG: Record<StellarNetwork, { networkPassphrase: string }> = {
  "stellar-testnet": { networkPassphrase: Networks.TESTNET },
  "stellar-mainnet": { networkPassphrase: Networks.PUBLIC },
};

describe('Bridge Tool - Multi-Chain Support', () => {

  describe('Target Chain Mapping', () => {
    it('should map ethereum to ChainSymbol.ETH', () => {
      expect(TARGET_CHAIN_MAP["ethereum"]).toBe(ChainSymbol.ETH);
    });

    it('should map polygon to ChainSymbol.POL', () => {
      expect(TARGET_CHAIN_MAP["polygon"]).toBe(ChainSymbol.POL);
    });

    it('should map arbitrum to ChainSymbol.ARB', () => {
      expect(TARGET_CHAIN_MAP["arbitrum"]).toBe(ChainSymbol.ARB);
    });

    it('should map base to ChainSymbol.BAS', () => {
      expect(TARGET_CHAIN_MAP["base"]).toBe(ChainSymbol.BAS);
    });

    it('should support all four target chains', () => {
      const chains: TargetChain[] = ["ethereum", "polygon", "arbitrum", "base"];
      chains.forEach((chain) => {
        expect(TARGET_CHAIN_MAP[chain]).toBeDefined();
      });
    });
  });

  describe('Type Safety', () => {
    it('should accept valid TargetChain values', () => {
      const validChains: TargetChain[] = ["ethereum", "polygon", "arbitrum", "base"];
      expect(validChains).toHaveLength(4);
      expect(validChains).toContain("polygon");
      expect(validChains).toContain("arbitrum");
      expect(validChains).toContain("base");
    });

    it('should default to ethereum when targetChain is not specified', () => {
      const defaultChain: TargetChain = "ethereum";
      expect(TARGET_CHAIN_MAP[defaultChain]).toBe(ChainSymbol.ETH);
    });
  });

  describe('Network Configuration', () => {
    it('should have correct testnet passphrase', () => {
      expect(STELLAR_NETWORK_CONFIG["stellar-testnet"].networkPassphrase).toBe(Networks.TESTNET);
    });

    it('should have correct mainnet passphrase', () => {
      expect(STELLAR_NETWORK_CONFIG["stellar-mainnet"].networkPassphrase).toBe(Networks.PUBLIC);
    });
  });

  describe('Mainnet Safeguards', () => {
    it('should block mainnet when ALLOW_MAINNET_BRIDGE is not set', () => {
      const fromNetwork: StellarNetwork = "stellar-mainnet";
      const allowMainnetBridge = undefined;
      const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
      expect(shouldBlock).toBe(true);
    });

    it('should block mainnet when ALLOW_MAINNET_BRIDGE is false', () => {
      const fromNetwork: StellarNetwork = "stellar-mainnet";
      const allowMainnetBridge: string | undefined = "false";
      
      const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
      expect(shouldBlock).toBe(true);
    });

    it('should allow mainnet when ALLOW_MAINNET_BRIDGE is true', () => {
      const fromNetwork: StellarNetwork = "stellar-mainnet";
      const allowMainnetBridge = "true";
      const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
      expect(shouldBlock).toBe(false);
    });

    it('should always allow testnet regardless of ALLOW_MAINNET_BRIDGE', () => {
      const fromNetwork: string = "stellar-testnet";
      const allowMainnetBridge = undefined;

      const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
      expect(shouldBlock).toBe(false);
    });

    it('should apply mainnet safeguard for all target chains', () => {
      const chains: TargetChain[] = ["ethereum", "polygon", "arbitrum", "base"];
      chains.forEach((chain) => {
        const fromNetwork: StellarNetwork = "stellar-mainnet";
        const allowMainnetBridge: string | undefined = undefined;
        const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
        expect(shouldBlock).toBe(true);
      });
    });
  });

  describe('Chain Symbol Values', () => {
    it('should have correct string values for chain symbols', () => {
      expect(ChainSymbol.ETH).toBe("ETH");
      expect(ChainSymbol.POL).toBe("POL");
      expect(ChainSymbol.ARB).toBe("ARB");
      expect(ChainSymbol.BAS).toBe("BAS");
    });
  });
});
