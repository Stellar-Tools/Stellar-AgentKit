import { describe, it, expect } from 'vitest';
import { AgentClient } from '../../agent';

describe('Tool Integration Workflows', () => {
  describe('AgentClient Initialization', () => {
    it('should create a testnet client without errors', () => {
      const agent = new AgentClient({
        network: 'testnet',
        publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      });
      expect(agent).toBeDefined();
    });

    it('should block mainnet without allowMainnet flag', () => {
      expect(() => {
        new AgentClient({ network: 'mainnet' });
      }).toThrow(/[Mm]ainnet/);
    });

    it('should allow mainnet with allowMainnet flag', () => {
      const agent = new AgentClient({
        network: 'mainnet',
        allowMainnet: true,
        publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      });
      expect(agent).toBeDefined();
    });
  });

  describe('Token Launch Validation', () => {
    it('should reject mainnet token launches', async () => {
      const agent = new AgentClient({
        network: 'mainnet',
        allowMainnet: true,
        publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      });

      await expect(
        agent.launchToken({
          code: 'TEST',
          issuerSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          distributorSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          initialSupply: '1000',
        })
      ).rejects.toThrow(/[Mm]ainnet/);
    });

    it('should reject invalid asset codes', async () => {
      const agent = new AgentClient({
        network: 'testnet',
        publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      });

      await expect(
        agent.launchToken({
          code: 'TOOLONGASSETCODE123',
          issuerSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          distributorSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          initialSupply: '1000',
        })
      ).rejects.toThrow(/[Aa]sset code/);
    });

    it('should reject asset codes with special characters', async () => {
      const agent = new AgentClient({
        network: 'testnet',
        publicKey: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      });

      await expect(
        agent.launchToken({
          code: 'MY-TOKEN!',
          issuerSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          distributorSecret: 'SCZANGBA5YHTNYVVV3C7CAZMCLPT4R3YNWECOUL6XELXHBCHJ3MGQOOY',
          initialSupply: '1000',
        })
      ).rejects.toThrow(/alphanumeric/);
    });
  });
});
