/**
 * Structured Logging System for Stellar AgentKit
 * 
 * Provides configurable logging with levels, transaction tracking,
 * and security-conscious output for financial operations.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  operation?: string;
  transactionId?: string;
  network?: 'testnet' | 'mainnet';
  message: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  enableStructuredOutput: boolean;
  sanitizeSensitiveData: boolean;
  includeStackTrace: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  enableConsole: true,
  enableFile: false,
  enableStructuredOutput: false,
  sanitizeSensitiveData: true,
  includeStackTrace: false,
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger class for structured logging throughout AgentKit
 */
export class Logger {
  private config: LoggerConfig;
  private module: string;
  private static globalConfig: LoggerConfig = DEFAULT_CONFIG;

  constructor(module: string, config?: Partial<LoggerConfig>) {
    this.module = module;
    this.config = { ...Logger.globalConfig, ...config };
  }

  /**
   * Configure global logger settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    Logger.globalConfig = { ...Logger.globalConfig, ...config };
  }

  /**
   * Create a new logger instance for a specific module
   */
  static create(module: string, config?: Partial<LoggerConfig>): Logger {
    return new Logger(module, config);
  }

  /**
   * Check if a log level should be output based on current configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Sanitize sensitive data from log entries
   */
  private sanitizeData(data: any): any {
    if (!this.config.sanitizeSensitiveData) {
      return data;
    }

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveKeys = [
      'secret',
      'privateKey',
      'private_key',
      'password',
      'seed',
      'mnemonic',
      'signature',
      'apiKey',
      'api_key',
    ];

    const sanitized = { ...data };
    
    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sensitive => lowerKey === sensitive || lowerKey.endsWith(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      metadata: metadata ? this.sanitizeData(metadata) : undefined,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTrace ? error.stack : undefined,
      } : undefined,
    };
  }

  /**
   * Output log entry to configured destinations
   */
  private output(entry: LogEntry): void {
    if (this.config.enableConsole) {
      if (this.config.enableStructuredOutput) {
        console.log(JSON.stringify(entry));
      } else {
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`;
        const message = entry.operation ? `${entry.operation}: ${entry.message}` : entry.message;
        
        switch (entry.level) {
          case 'debug':
            console.debug(prefix, message, entry.metadata || '');
            break;
          case 'info':
            console.info(prefix, message, entry.metadata || '');
            break;
          case 'warn':
            console.warn(prefix, message, entry.metadata || '');
            break;
          case 'error':
            console.error(prefix, message, entry.error || entry.metadata || '');
            break;
        }
      }
    }

    // File logging could be implemented here if needed
    // For now, we focus on console output for the SDK
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    
    const entry = this.createLogEntry('debug', message, metadata);
    this.output(entry);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    
    const entry = this.createLogEntry('info', message, metadata);
    this.output(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    
    const entry = this.createLogEntry('warn', message, metadata);
    this.output(entry);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    
    const entry = this.createLogEntry('error', message, metadata, error);
    this.output(entry);
  }

  /**
   * Log a transaction operation
   */
  logTransaction(
    operation: string,
    transactionId: string,
    network: 'testnet' | 'mainnet',
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      'info',
      `Transaction: ${operation}`,
      {
        ...metadata,
        transactionId,
        network,
        operation,
      }
    );
    this.output(entry);
  }

  /**
   * Log a DEX operation
   */
  logDexOperation(
    operation: 'quote' | 'swap',
    params: Record<string, any>,
    result?: any
  ): void {
    this.info(
      `DEX ${operation}`,
      {
        operation,
        params: this.sanitizeData(params),
        result: result ? this.sanitizeData(result) : undefined,
      }
    );
  }

  /**
   * Log a bridge operation
   */
  logBridgeOperation(
    operation: 'initiated' | 'pending' | 'confirmed' | 'failed',
    params: Record<string, any>,
    result?: any
  ): void {
    this.info(
      `Bridge ${operation}`,
      {
        operation,
        params: this.sanitizeData(params),
        result: result ? this.sanitizeData(result) : undefined,
      }
    );
  }

  /**
   * Log a liquidity pool operation
   */
  logLPOperation(
    operation: 'deposit' | 'withdraw' | 'query',
    params: Record<string, any>,
    result?: any
  ): void {
    this.info(
      `LP ${operation}`,
      {
        operation,
        params: this.sanitizeData(params),
        result: result ? this.sanitizeData(result) : undefined,
      }
    );
  }

  /**
   * Log a token launch operation
   */
  logTokenLaunch(
    operation: 'validation' | 'creation' | 'trustline' | 'minting' | 'locking',
    tokenCode: string,
    metadata?: Record<string, any>
  ): void {
    this.info(
      `Token Launch ${operation}`,
      {
        operation,
        tokenCode,
        ...this.sanitizeData(metadata),
      }
    );
  }
}

/**
 * Default logger instance
 */
export const logger = Logger.create('AgentKit');

/**
 * Convenience function to create logger instances
 */
export function createLogger(module: string, config?: Partial<LoggerConfig>): Logger {
  return Logger.create(module, config);
}
