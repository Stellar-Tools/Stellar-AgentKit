/**
 * Event Monitoring System for Stellar AgentKit
 * 
 * Provides real-time event tracking and transaction history for all operations.
 * Essential for production systems: debugging, auditing, monitoring, and observability.
 */

import { EventEmitter } from 'events';

/**
 * Operation types that generate events
 */
export enum OperationType {
  SWAP = 'swap',
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  BRIDGE = 'bridge',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CLAIM = 'claim',
}

/**
 * Event status codes
 */
export enum EventStatus {
  INITIATED = 'initiated',
  VALIDATING = 'validating',
  SIMULATING = 'simulating',
  SIGNING = 'signing',
  SUBMITTING = 'submitting',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Detailed event record for each operation
 */
export interface TransactionEvent {
  id: string;                          // Unique event ID
  timestamp: number;                   // Unix timestamp
  operationType: OperationType;        // What operation was performed
  status: EventStatus;                 // Current status
  
  // Operation details
  details: {
    from?: string;                     // Source address
    to?: string;                       // Destination address
    amount?: string;                   // Amount involved
    asset?: string;                    // Asset symbol
    contract?: string;                 // Contract address
    [key: string]: any;                // Dynamic fields
  };
  
  // Network info
  network: 'testnet' | 'mainnet';
  ledger?: number;
  transactionHash?: string;
  
  // Error info (if failed)
  error?: {
    code: string;
    message: string;
    context?: Record<string, any>;
  };
  
  // Timing
  startTime: number;
  endTime?: number;
  duration?: number;                   // ms
}

/**
 * Transaction history query filter
 */
export interface HistoryFilter {
  operationType?: OperationType | OperationType[];
  status?: EventStatus | EventStatus[];
  startTime?: number;                  // Unix timestamp
  endTime?: number;                    // Unix timestamp
  network?: 'testnet' | 'mainnet';
  limit?: number;                      // Max results
  offset?: number;                     // Pagination
}

/**
 * Event monitoring service
 * 
 * Tracks all operations and provides:
 * - Real-time event subscriptions
 * - Transaction history queries
 * - Event filtering and searching
 * - Automatic cleanup of old events
 */
export class EventMonitor extends EventEmitter {
  private history: Map<string, TransactionEvent> = new Map();
  private readonly maxHistorySize: number;
  private cleanupInterval: NodeJS.Timer | null = null;
  private eventIdCounter = 0;

  constructor(maxHistorySize: number = 10000) {
    super();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${++this.eventIdCounter}`;
  }

  /**
   * Record an event
   */
  recordEvent(
    operationType: OperationType,
    details: Record<string, any>,
    network: 'testnet' | 'mainnet' = 'testnet'
  ): string {
    const eventId = this.generateEventId();
    
    const event: TransactionEvent = {
      id: eventId,
      timestamp: Date.now(),
      operationType,
      status: EventStatus.INITIATED,
      details,
      network,
      startTime: Date.now(),
    };

    this.history.set(eventId, event);
    this.emit(operationType, event);
    this.emit('event', event);

    // Cleanup if needed
    if (this.history.size > this.maxHistorySize) {
      this.cleanup();
    }

    return eventId;
  }

  /**
   * Update event status
   */
  updateStatus(
    eventId: string,
    status: EventStatus,
    errorInfo?: { code: string; message: string; context?: Record<string, any> }
  ): void {
    const event = this.history.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.status = status;
    if (errorInfo) {
      event.error = errorInfo;
    }

    if (status === EventStatus.CONFIRMED || status === EventStatus.FAILED) {
      event.endTime = Date.now();
      event.duration = event.endTime - event.startTime;
    }

    this.emit(`${event.operationType}:${status}`, event);
    this.emit('statusUpdate', event);
  }

  /**
   * Add transaction hash when confirmed on ledger
   */
  setTransactionHash(eventId: string, hash: string, ledger: number): void {
    const event = this.history.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    event.transactionHash = hash;
    event.ledger = ledger;
    this.updateStatus(eventId, EventStatus.CONFIRMED);
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): TransactionEvent | undefined {
    return this.history.get(eventId);
  }

  /**
   * Query transaction history
   */
  queryHistory(filter: HistoryFilter = {}): TransactionEvent[] {
    const {
      operationType,
      status,
      startTime = 0,
      endTime = Date.now(),
      network,
      limit = 100,
      offset = 0,
    } = filter;

    let results = Array.from(this.history.values());

    // Apply filters
    if (operationType) {
      const types = Array.isArray(operationType) ? operationType : [operationType];
      results = results.filter(e => types.includes(e.operationType));
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      results = results.filter(e => statuses.includes(e.status));
    }

    if (startTime || endTime) {
      results = results.filter(
        e => e.timestamp >= startTime && e.timestamp <= endTime
      );
    }

    if (network) {
      results = results.filter(e => e.network === network);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    return results.slice(offset, offset + limit);
  }

  /**
   * Get statistics about events
   */
  getStats(filter?: HistoryFilter): {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    avgDuration: number;
    successRate: number;
  } {
    const events = this.queryHistory({ ...filter, limit: 100000 });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalDuration = 0;
    let completedEvents = 0;

    for (const event of events) {
      byType[event.operationType] = (byType[event.operationType] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;

      if (event.duration) {
        totalDuration += event.duration;
        completedEvents++;
      }
    }

    const successCount = byStatus[EventStatus.CONFIRMED] || 0;
    const failedCount = byStatus[EventStatus.FAILED] || 0;

    return {
      total: events.length,
      byType,
      byStatus,
      avgDuration: completedEvents > 0 ? totalDuration / completedEvents : 0,
      successRate: (successCount + failedCount) > 0 
        ? successCount / (successCount + failedCount) 
        : 0,
    };
  }

  /**
   * Clear old events (older than given timestamp)
   */
  clearOlderThan(timestamp: number): number {
    let removed = 0;
    for (const [id, event] of this.history.entries()) {
      if (event.timestamp < timestamp) {
        this.history.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history.clear();
    this.eventIdCounter = 0;
  }

  /**
   * Start automatic cleanup of old events
   * Removes events older than 7 days by default
   */
  startAutoCleanup(intervalMs: number = 60000, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - maxAgeMs;
      const removed = this.clearOlderThan(cutoff);
      if (removed > 0) {
        this.emit('cleanup', { removed, timestamp: Date.now() });
      }
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Manual cleanup - removes oldest 10% when at max capacity
   */
  private cleanup(): void {
    if (this.history.size <= this.maxHistorySize) return;

    const sorted = Array.from(this.history.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.ceil(this.maxHistorySize * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.history.delete(sorted[i][0]);
    }
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.history.size;
  }

  /**
   * Export history as JSON
   */
  exportHistory(filter?: HistoryFilter): string {
    const events = this.queryHistory({ ...filter, limit: 100000 });
    return JSON.stringify(events, null, 2);
  }
}

/**
 * Global event monitor instance
 */
export const eventMonitor = new EventMonitor();
