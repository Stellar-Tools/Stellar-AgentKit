import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, createLogger, LoggerConfig } from '../../../utils/logger';

describe('Logger System', () => {
  let originalConsole: typeof console;
  let mockConsole: {
    log: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock console methods
    originalConsole = global.console;
    mockConsole = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console = mockConsole as any;
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
  });

  describe('Basic Logging', () => {
    it('should create logger with module name', () => {
      const logger = createLogger('TestModule');
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should log info messages', () => {
      const logger = createLogger('TestModule');
      logger.info('Test message', { normalField: 'value' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Test message',
        { normalField: 'value' }
      );
    });

    it('should log warning messages', () => {
      const logger = createLogger('TestModule');
      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [TestModule]'),
        'Warning message',
        ''
      );
    });

    it('should log error messages with error object', () => {
      const logger = createLogger('TestModule');
      const error = new Error('Test error');
      logger.error('Error occurred', error, { context: 'test' });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [TestModule]'),
        'Error occurred',
        expect.objectContaining({
          name: 'Error',
          message: 'Test error',
        })
      );
    });

    it('should respect log levels', () => {
      const logger = createLogger('TestModule', { level: 'warn' });
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('Structured Output', () => {
    it('should output structured JSON when enabled', () => {
      const logger = createLogger('TestModule', { enableStructuredOutput: true });
      logger.info('Test message', { key: 'value' });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"module":"TestModule"')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      );
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize sensitive data by default', () => {
      const logger = createLogger('TestModule');
      logger.info('Test message', {
        publicKey: 'GABC123...',
        privateKey: 'SAMPLE_PRIVATE_KEY',
        secret: 'sample_secret',
        password: 'sample_password',
        normalField: 'visible'
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Test message',
        expect.objectContaining({
          publicKey: 'GABC123...', // Public keys should not be sanitized
          privateKey: '[REDACTED]',
          secret: '[REDACTED]',
          password: '[REDACTED]',
          normalField: 'visible'
        })
      );
    });

    it('should not sanitize when disabled', () => {
      const logger = createLogger('TestModule', { sanitizeSensitiveData: false });
      logger.info('Test message', {
        privateKey: 'SAMPLE_PRIVATE_KEY',
        secret: 'sample_secret'
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          privateKey: 'SAMPLE_PRIVATE_KEY',
          secret: 'sample_secret'
        })
      );
    });

    it('should handle nested objects with sensitive data', () => {
      const logger = createLogger('TestModule');
      logger.info('Test message', {
        user: {
          name: 'John',
          privateKey: 'SAMPLE_PRIVATE_KEY',
          profile: {
            secret: 'sample_secret',
            public: 'visible'
          }
        }
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Test message',
        expect.objectContaining({
          user: expect.objectContaining({
            name: 'John',
            privateKey: '[REDACTED]',
            profile: expect.objectContaining({
              secret: '[REDACTED]',
              public: 'visible'
            })
          })
        })
      );
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log transaction operations', () => {
      const logger = createLogger('TestModule');
      logger.logTransaction(
        'swap',
        'tx_123',
        'testnet',
        { amount: '100', asset: 'USDC' }
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Transaction: swap',
        expect.objectContaining({
          transactionId: 'tx_123',
          network: 'testnet',
          operation: 'swap',
          amount: '100',
          asset: 'USDC'
        })
      );
    });

    it('should log DEX operations', () => {
      const logger = createLogger('TestModule');
      logger.logDexOperation('quote', { from: 'USDC', to: 'EURC' }, { price: '0.85' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'DEX quote',
        expect.objectContaining({
          operation: 'quote',
          params: { from: 'USDC', to: 'EURC' },
          result: { price: '0.85' }
        })
      );
    });

    it('should log bridge operations', () => {
      const logger = createLogger('TestModule');
      logger.logBridgeOperation('initiated', { amount: '100', target: 'ethereum' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Bridge initiated',
        expect.objectContaining({
          operation: 'initiated',
          params: { amount: '100', target: 'ethereum' }
        })
      );
    });

    it('should log LP operations', () => {
      const logger = createLogger('TestModule');
      logger.logLPOperation('deposit', { pool: 'USDC-EURC', amount: '100' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'LP deposit',
        expect.objectContaining({
          operation: 'deposit',
          params: { pool: 'USDC-EURC', amount: '100' }
        })
      );
    });

    it('should log token launch operations', () => {
      const logger = createLogger('TestModule');
      logger.logTokenLaunch('creation', 'TESTTOKEN', { issuer: 'GABC123...' });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestModule]'),
        'Token Launch creation',
        expect.objectContaining({
          operation: 'creation',
          tokenCode: 'TESTTOKEN',
          issuer: 'GABC123...'
        })
      );
    });
  });

  describe('Global Configuration', () => {
  beforeEach(() => {
    // Reset logger configuration before each test
    Logger.configure({
      level: 'info',
      enableConsole: true,
      enableStructuredOutput: false,
      sanitizeSensitiveData: true,
      includeStackTrace: false,
    });
  });

  it('should apply global configuration to all loggers', () => {
    Logger.configure({ level: 'error', enableStructuredOutput: true });
    
    const logger1 = createLogger('Module1');
    const logger2 = createLogger('Module2');
    
    logger1.info('Should not appear');
    logger2.error('Should appear');

    expect(mockConsole.log).toHaveBeenCalledWith(
      expect.stringContaining('"level":"error"')
    );
    expect(mockConsole.log).toHaveBeenCalledTimes(1);
  });

  it('should allow per-logger configuration override', () => {
    Logger.configure({ level: 'error' });
    
    const logger = createLogger('TestModule', { level: 'debug' });
    logger.info('Should appear');
    
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [TestModule]'),
      'Should appear',
      ''
    );
  });
  });

  describe('Configuration Validation', () => {
    it('should handle console disabled', () => {
      const logger = createLogger('TestModule', { enableConsole: false });
      logger.info('Should not appear');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should include stack trace when enabled', () => {
      const logger = createLogger('TestModule', { includeStackTrace: true, level: 'debug' });
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [TestModule]'),
        'Error occurred',
        expect.objectContaining({
          stack: expect.stringContaining('Error: Test error')
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined metadata', () => {
      const logger = createLogger('TestModule');
      
      expect(() => {
        logger.info('Test message', null as any);
        logger.info('Test message', undefined);
      }).not.toThrow();
    });

    it('should handle circular references in metadata', () => {
      const logger = createLogger('TestModule');
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        logger.info('Test message', circular);
      }).not.toThrow();
    });

    it('should handle empty module names', () => {
      const logger = createLogger('', { level: 'debug' });
      logger.info('Test message');
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] []'),
        'Test message',
        ''
      );
    });
  });
});
