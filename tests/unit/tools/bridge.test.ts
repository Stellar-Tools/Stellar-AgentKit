import { describe, it, expect } from 'vitest';
import { bridgeTokenTool } from '../../tools/bridge';

describe('Bridge Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(bridgeTokenTool.name).toBe('bridge_token');
    });

    it('should have a description', () => {
      expect(bridgeTokenTool.description).toBeTruthy();
      expect(bridgeTokenTool.description.length).toBeGreaterThan(0);
    });

    it('should have a schema defined', () => {
      expect(bridgeTokenTool.schema).toBeDefined();
    });
  });

  describe('Mainnet Safety', () => {
    it('should block mainnet bridging when ALLOW_MAINNET_BRIDGE is not set', async () => {
      const originalEnv = process.env.ALLOW_MAINNET_BRIDGE;
      delete process.env.ALLOW_MAINNET_BRIDGE;

      await expect(
        bridgeTokenTool.func({
          amount: "100",
          toAddress: "0x742d35Cc6Db050e3797bf604dC8a98c13a0e002E",
          fromNetwork: "stellar-mainnet",
        })
      ).rejects.toThrow(/[Mm]ainnet/);

      // Restore
      if (originalEnv !== undefined) {
        process.env.ALLOW_MAINNET_BRIDGE = originalEnv;
      }
    });
  });
});
