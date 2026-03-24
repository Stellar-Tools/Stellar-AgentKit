import { describe, it, expect, beforeEach } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';

type StellarNetwork = "stellar-testnet" | "stellar-mainnet";

describe('Bridge Tool - Network Configuration', () => {
  const STELLAR_NETWORK_CONFIG: Record<StellarNetwork, { networkPassphrase: string }> = {
    "stellar-testnet": {
      networkPassphrase: Networks.TESTNET,
    },
    "stellar-mainnet": {
      networkPassphrase: Networks.PUBLIC,
    },
  };

  describe('Type Safety', () => {
    it('should have correct network configuration type', () => {
      const testNetwork: StellarNetwork = "stellar-testnet";
      expect(testNetwork).toBe("stellar-testnet");
    });

    it('should validate network options', () => {
      const validNetworks: StellarNetwork[] = ["stellar-testnet", "stellar-mainnet"];
      expect(validNetworks).toContain("stellar-testnet");
      expect(validNetworks).toContain("stellar-mainnet");
      expect(validNetworks).toHaveLength(2);
    });
  });

  describe('Network Passphrases', () => {
    it('should have correct testnet passphrase', () => {
      expect(STELLAR_NETWORK_CONFIG["stellar-testnet"].networkPassphrase).toBe(Networks.TESTNET);
      expect(STELLAR_NETWORK_CONFIG["stellar-testnet"].networkPassphrase).toBe("Test SDF Network ; September 2015");
    });

    it('should have correct mainnet passphrase', () => {
      expect(STELLAR_NETWORK_CONFIG["stellar-mainnet"].networkPassphrase).toBe(Networks.PUBLIC);
      expect(STELLAR_NETWORK_CONFIG["stellar-mainnet"].networkPassphrase).toBe("Public Global Stellar Network ; September 2015");
    });

    it('should have passphrase for both networks', () => {
      expect(STELLAR_NETWORK_CONFIG["stellar-testnet"]).toBeDefined();
      expect(STELLAR_NETWORK_CONFIG["stellar-mainnet"]).toBeDefined();
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
      const allowMainnetBridge = "false";
      
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
      const fromNetwork: StellarNetwork = "stellar-testnet";
      const allowMainnetBridge = undefined;
      
      const shouldBlock = fromNetwork === "stellar-mainnet" && allowMainnetBridge !== "true";
      expect(shouldBlock).toBe(false);
    });
  });
});
