/**
 * Example demonstrating the logging system in Stellar AgentKit
 * 
 * This example shows:
 * - Basic logger configuration
 * - Different log levels
 * - Specialized logging methods for financial operations
 * - Data sanitization for security
 */

import { AgentClient } from '../agent';
import { Logger, createLogger } from '../utils/logger';

// Configure global logging settings
Logger.configure({
  level: 'info', // Show info, warn, and error messages
  enableConsole: true,
  enableStructuredOutput: false, // Set to true for JSON output in production
  sanitizeSensitiveData: true, // Always sanitize sensitive data
  includeStackTrace: false, // Include stack traces for debugging
});

async function demonstrateLogging() {
  console.log('=== Stellar AgentKit Logging Example ===\n');

  // Example 1: Basic AgentClient with logging
  console.log('1. AgentClient Initialization:');
  try {
    const agent = new AgentClient({
      network: 'testnet',
      publicKey: process.env.STELLAR_PUBLIC_KEY || 'GABC123...',
    });
    // AgentClient will automatically log initialization
  } catch (error) {
    console.log('Expected error for demo purposes');
  }

  // Example 2: Mainnet safety logging
  console.log('\n2. Mainnet Safety Logging:');
  try {
    const agent = new AgentClient({
      network: 'mainnet',
      allowMainnet: true, // This will trigger a warning log
      publicKey: process.env.STELLAR_PUBLIC_KEY || 'GABC123...',
    });
  } catch (error) {
    console.log('Expected error for demo purposes');
  }

  // Example 3: Custom logger for operations
  console.log('\n3. Custom Logger Usage:');
  const operationLogger = createLogger('TokenOperations');
  
  operationLogger.info('Starting token operation', {
    tokenCode: 'USDC',
    operation: 'swap',
    amount: '100',
  });

  operationLogger.warn('Low liquidity detected', {
    pool: 'USDC-EURC',
    liquidity: '500',
    threshold: '1000',
  });

  operationLogger.error('Transaction failed', new Error('Insufficient funds'), {
    transactionId: 'tx_12345',
    attemptedAmount: '100',
    availableBalance: '50',
  });

  // Example 4: Specialized logging methods
  console.log('\n4. Specialized Financial Operation Logging:');
  const dexLogger = createLogger('DEXOperations');
  
  // DEX operation logging
  dexLogger.logDexOperation('quote', {
    sendAsset: 'USDC',
    destAsset: 'EURC',
    sendAmount: '100',
  }, {
    destAmount: '85.50',
    price: '0.855',
    hopCount: 1,
  });

  // Bridge operation logging
  const bridgeLogger = createLogger('BridgeOperations');
  bridgeLogger.logBridgeOperation('initiated', {
    amount: '100',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    targetChain: 'ethereum',
  });

  bridgeLogger.logBridgeOperation('confirmed', {
    amount: '100',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    targetChain: 'ethereum',
  }, {
    status: 'confirmed',
    hash: 'abc123...',
    network: 'stellar-testnet',
  });

  // Liquidity pool operation logging
  const lpLogger = createLogger('LPOperations');
  lpLogger.logLPOperation('deposit', {
    pool: 'USDC-EURC',
    desiredA: '100',
    desiredB: '85.50',
  }, {
    shareAmount: '95.25',
    transactionHash: 'def456...',
  });

  // Token launch logging
  const tokenLogger = createLogger('TokenLaunch');
  tokenLogger.logTokenLaunch('validation', 'MYTOKEN');
  tokenLogger.logTokenLaunch('creation', 'MYTOKEN', {
    issuer: 'GABC123...',
    distributor: 'GDEF456...',
  });
  tokenLogger.logTokenLaunch('minting', 'MYTOKEN', {
    initialSupply: '1000000',
    recipient: 'GDEF456...',
  });

  // Example 5: Data sanitization demonstration
  console.log('\n5. Data Sanitization (Sensitive data redaction):');
  const securityLogger = createLogger('SecurityDemo');
  
  securityLogger.info('User authentication', {
    username: 'john_doe',
    publicKey: 'GABC123DEF456...', // Public keys are shown
    privateKey: 'SSECRET123...',  // Private keys are redacted
    password: 'secret123',       // Passwords are redacted
    apiKey: 'key_abc123',        // API keys are redacted
    normalField: 'visible',      // Normal fields are shown
  });

  // Example 6: Transaction logging
  console.log('\n6. Transaction Logging:');
  const txLogger = createLogger('Transactions');
  
  txLogger.logTransaction(
    'swap',
    'tx_789xyz',
    'testnet',
    {
      fromAsset: 'USDC',
      toAsset: 'EURC',
      amount: '100',
      slippage: '1%',
    }
  );

  txLogger.logTransaction(
    'bridge',
    'tx_999abc',
    'testnet',
    {
      amount: '50',
      targetChain: 'polygon',
      toAddress: '0x123...',
    }
  );

  console.log('\n=== Logging Example Complete ===');
}

// Example 7: Production configuration
function setupProductionLogging() {
  console.log('\n7. Production Logging Configuration:');
  
  // In production, you might want structured JSON output
  Logger.configure({
    level: 'warn', // Only show warnings and errors in production
    enableConsole: true,
    enableStructuredOutput: true, // JSON format for log aggregation
    sanitizeSensitiveData: true,  // Always sanitize in production
    includeStackTrace: true,      // Include stack traces for debugging
  });

  const prodLogger = createLogger('ProductionService');
  
  prodLogger.warn('High gas price detected', {
    gasPrice: '150',
    threshold: '100',
    network: 'mainnet',
  });

  prodLogger.error('Critical system error', new Error('Database connection failed'), {
    service: 'bridge',
    region: 'us-east-1',
    timestamp: new Date().toISOString(),
  });
}

// Run the examples
if (require.main === module) {
  demonstrateLogging()
    .then(() => setupProductionLogging())
    .catch(console.error);
}

export { demonstrateLogging, setupProductionLogging };
