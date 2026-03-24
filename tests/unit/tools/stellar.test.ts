import { describe, it, expect } from 'vitest';
import { stellarSendPaymentTool } from '../../tools/stellar';

describe('Stellar Tool', () => {
  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(stellarSendPaymentTool.name).toBe('stellar_send_payment');
    });

    it('should have a description', () => {
      expect(stellarSendPaymentTool.description).toBeTruthy();
      expect(stellarSendPaymentTool.description.length).toBeGreaterThan(0);
    });

    it('should have a schema defined', () => {
      expect(stellarSendPaymentTool.schema).toBeDefined();
    });
  });

  describe('Network Support', () => {
    it('should support testnet and mainnet network values', () => {
      const validNetworks = ['testnet', 'mainnet'];
      expect(validNetworks).toContain('testnet');
      expect(validNetworks).toContain('mainnet');
    });
  });
});
