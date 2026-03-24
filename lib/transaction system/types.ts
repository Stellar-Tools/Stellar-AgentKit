export type ActionType = "swap" | "deposit" | "withdraw" | "bridge" | "custom";

export interface TransactionStep {
    id: string;
    action: ActionType;
    params?: any;
    execute: () => Promise<any>;
}

export interface Route {
    id: string;
    steps: TransactionStep[];
}

export interface ExecutionStrategy {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
    fallbackRoutes?: Route[];
}

export enum ErrorType {
    TRANSIENT = "TRANSIENT",
    PERMANENT = "PERMANENT",
    UNKNOWN = "UNKNOWN"
}

export class AntigravityError extends Error {
    public type: ErrorType;
    public originalError: any;
    
    constructor(message: string, type: ErrorType, originalError?: any) {
        super(message);
        this.name = "AntigravityError";
        this.type = type;
        this.originalError = originalError;
    }
}
