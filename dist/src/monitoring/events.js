"use strict";
/**
 * Event Monitoring System for Stellar AgentKit
 *
 * Provides real-time event tracking and transaction history for all operations.
 * Essential for production systems: debugging, auditing, monitoring, and observability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventMonitor = exports.EventMonitor = exports.EventStatus = exports.OperationType = void 0;
const events_1 = require("events");
/**
 * Operation types that generate events
 */
var OperationType;
(function (OperationType) {
    OperationType["SWAP"] = "swap";
    OperationType["DEPOSIT"] = "deposit";
    OperationType["WITHDRAW"] = "withdraw";
    OperationType["BRIDGE"] = "bridge";
    OperationType["STAKE"] = "stake";
    OperationType["UNSTAKE"] = "unstake";
    OperationType["CLAIM"] = "claim";
})(OperationType || (exports.OperationType = OperationType = {}));
/**
 * Event status codes
 */
var EventStatus;
(function (EventStatus) {
    EventStatus["INITIATED"] = "initiated";
    EventStatus["VALIDATING"] = "validating";
    EventStatus["SIMULATING"] = "simulating";
    EventStatus["SIGNING"] = "signing";
    EventStatus["SUBMITTING"] = "submitting";
    EventStatus["CONFIRMED"] = "confirmed";
    EventStatus["FAILED"] = "failed";
    EventStatus["CANCELLED"] = "cancelled";
})(EventStatus || (exports.EventStatus = EventStatus = {}));
/**
 * Event monitoring service
 *
 * Tracks all operations and provides:
 * - Real-time event subscriptions
 * - Transaction history queries
 * - Event filtering and searching
 * - Automatic cleanup of old events
 */
class EventMonitor extends events_1.EventEmitter {
    constructor(maxHistorySize = 10000) {
        super();
        this.history = new Map();
        this.cleanupInterval = null;
        this.eventIdCounter = 0;
        if (!Number.isFinite(maxHistorySize) || !Number.isInteger(maxHistorySize) || maxHistorySize <= 0) {
            throw new Error(`maxHistorySize must be a positive integer, got ${maxHistorySize}`);
        }
        this.maxHistorySize = maxHistorySize;
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `evt_${Date.now()}_${++this.eventIdCounter}`;
    }
    /**
     * Record an event
     */
    recordEvent(operationType, details, network = 'testnet') {
        const eventId = this.generateEventId();
        const event = {
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
    updateStatus(eventId, status, errorInfo) {
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
    setTransactionHash(eventId, hash, ledger) {
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
    getEvent(eventId) {
        return this.history.get(eventId);
    }
    /**
     * Query transaction history
     */
    queryHistory(filter = {}) {
        const { operationType, status, startTime = 0, endTime = Date.now(), network, limit = 100, offset = 0, } = filter;
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
            results = results.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
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
    getStats(filter) {
        const events = this.queryHistory({ ...filter, limit: 100000 });
        const byType = {};
        const byStatus = {};
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
    clearOlderThan(timestamp) {
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
    clearHistory() {
        this.history.clear();
        this.eventIdCounter = 0;
    }
    /**
     * Start automatic cleanup of old events
     * Removes events older than 7 days by default
     */
    startAutoCleanup(intervalMs = 60000, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        if (this.cleanupInterval)
            return;
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
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    /**
     * Manual cleanup - removes oldest 10% when at max capacity
     */
    cleanup() {
        if (this.history.size <= this.maxHistorySize)
            return;
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
    getHistorySize() {
        return this.history.size;
    }
    /**
     * Export history as JSON
     */
    exportHistory(filter) {
        const events = this.queryHistory({ ...filter, limit: 100000 });
        return JSON.stringify(events, null, 2);
    }
}
exports.EventMonitor = EventMonitor;
/**
 * Global event monitor instance
 */
exports.eventMonitor = new EventMonitor();
