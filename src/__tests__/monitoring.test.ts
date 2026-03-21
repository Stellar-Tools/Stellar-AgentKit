/**
 * Tests for Event Monitoring System
 */

import {
  EventMonitor,
  OperationType,
  EventStatus,
  eventMonitor,
} from '../monitoring/events';

describe('Event Monitoring System', () => {
  let monitor: EventMonitor;

  beforeEach(() => {
    monitor = new EventMonitor(1000);
  });

  describe('recordEvent', () => {
    it('should record event with unique ID', () => {
      const eventId = monitor.recordEvent(
        OperationType.SWAP,
        { amount: '100' },
        'testnet'
      );

      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^evt_\d+_\d+$/);
    });

    it('should store event with correct details', () => {
      const details = { from: 'G...', amount: '100' };
      const eventId = monitor.recordEvent(
        OperationType.SWAP,
        details,
        'testnet'
      );

      const event = monitor.getEvent(eventId);
      expect(event).toBeDefined();
      expect(event!.operationType).toBe(OperationType.SWAP);
      expect(event!.details).toEqual(details);
      expect(event!.network).toBe('testnet');
    });
  });

  describe('updateStatus', () => {
    it('should update event status', () => {
      const eventId = monitor.recordEvent(
        OperationType.SWAP,
        { amount: '100' },
        'testnet'
      );

      monitor.updateStatus(eventId, EventStatus.VALIDATING);
      const event = monitor.getEvent(eventId);

      expect(event!.status).toBe(EventStatus.VALIDATING);
    });

    it('should set error when status is FAILED', () => {
      const eventId = monitor.recordEvent(
        OperationType.SWAP,
        { amount: '100' },
        'testnet'
      );

      monitor.updateStatus(eventId, EventStatus.FAILED, {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Not enough balance',
      });

      const event = monitor.getEvent(eventId);
      expect(event!.error).toBeDefined();
      expect(event!.error!.code).toBe('INSUFFICIENT_FUNDS');
    });

    it('should calculate duration when event completes', () => {
      const eventId = monitor.recordEvent(
        OperationType.SWAP,
        { amount: '100' },
        'testnet'
      );

      // Small delay to have non-zero duration
      setTimeout(() => {
        monitor.updateStatus(eventId, EventStatus.CONFIRMED);
        const event = monitor.getEvent(eventId);

        expect(event!.endTime).toBeDefined();
        expect(event!.duration).toBeGreaterThanOrEqual(0);
      }, 10);
    });
  });

  describe('queryHistory', () => {
    beforeEach(() => {
      // Create various events
      monitor.recordEvent(OperationType.SWAP, { amount: '100' }, 'testnet');
      monitor.recordEvent(OperationType.DEPOSIT, { amount: '50' }, 'testnet');
      monitor.recordEvent(OperationType.SWAP, { amount: '200' }, 'mainnet');
      monitor.recordEvent(OperationType.WITHDRAW, { amount: '30' }, 'testnet');
    });

    it('should filter by operation type', () => {
      const swaps = monitor.queryHistory({ operationType: OperationType.SWAP });
      expect(swaps.length).toBe(2);
      expect(swaps.every(e => e.operationType === OperationType.SWAP)).toBe(true);
    });

    it('should filter by network', () => {
      const mainnet = monitor.queryHistory({ network: 'mainnet' });
      expect(mainnet.length).toBe(1);
      expect(mainnet[0].network).toBe('mainnet');
    });

    it('should filter by multiple operation types', () => {
      const result = monitor.queryHistory({
        operationType: [OperationType.SWAP, OperationType.DEPOSIT],
      });
      expect(result.length).toBe(3);
    });

    it('should respect limit and offset', () => {
      const first = monitor.queryHistory({ limit: 2 });
      expect(first.length).toBe(2);

      const next = monitor.queryHistory({ limit: 2, offset: 2 });
      expect(next.length).toBe(2);

      // Verify no overlap
      const ids1 = new Set(first.map(e => e.id));
      expect(next.some(e => ids1.has(e.id))).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        const id = monitor.recordEvent(OperationType.SWAP, {}, 'testnet');
        monitor.updateStatus(id, EventStatus.CONFIRMED);
      }

      for (let i = 0; i < 2; i++) {
        const id = monitor.recordEvent(OperationType.DEPOSIT, {}, 'testnet');
        monitor.updateStatus(id, EventStatus.FAILED, {
          code: 'ERROR',
          message: 'Test error',
        });
      }
    });

    it('should calculate correct statistics', () => {
      const stats = monitor.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byType[OperationType.SWAP]).toBe(3);
      expect(stats.byType[OperationType.DEPOSIT]).toBe(2);
      expect(stats.byStatus[EventStatus.CONFIRMED]).toBe(3);
      expect(stats.byStatus[EventStatus.FAILED]).toBe(2);
      expect(stats.successRate).toBe(0.6); // 3 success / 5 total
    });
  });

  describe('clearOlderThan', () => {
    it('should remove events older than timestamp', () => {
      const now = Date.now();
      const oldTime = now - 10000; // 10 seconds ago

      // Record event and manually set old timestamp
      const id = monitor.recordEvent(OperationType.SWAP, {}, 'testnet');
      const event = monitor.getEvent(id)!;
      event.timestamp = oldTime;

      const removed = monitor.clearOlderThan(now - 5000);
      expect(removed).toBe(1);
      expect(monitor.getEvent(id)).toBeUndefined();
    });
  });

  describe('event listeners', () => {
    it('should emit events correctly', (done) => {
      let emitted = false;

      monitor.on(OperationType.SWAP, (event) => {
        expect(event.operationType).toBe(OperationType.SWAP);
        emitted = true;
      });

      monitor.recordEvent(OperationType.SWAP, { amount: '100' }, 'testnet');

      setTimeout(() => {
        expect(emitted).toBe(true);
        done();
      }, 10);
    });
  });
});
