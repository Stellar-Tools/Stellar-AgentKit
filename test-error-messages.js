// Simple test to verify error message improvements
const { AgentClient } = require('./dist/agent');

// Mock test to check error messages
async function testErrorMessages() {
  console.log('Testing error message improvements...');
  
  try {
    // This should fail with an enhanced error message
    const client = new AgentClient({
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      publicKey: 'GABCDEFG...'
    });
    
    // This will fail but should provide a detailed error message
    await client.swapOptimized({
      sendAsset: { type: 'native' },
      destAsset: { code: 'USD', issuer: 'GABC...' },
      sendAmount: '100',
      strategy: 'invalid-strategy'
    });
    
  } catch (error) {
    console.log('Error caught:', error.message);
    console.log('Error name:', error.name);
    
    // Check if the error contains our enhanced context
    if (error.message.includes('network') && 
        error.message.includes('strategy') && 
        error.message.includes('Path')) {
      console.log('✅ Enhanced error message test PASSED');
    } else {
      console.log('❌ Enhanced error message test FAILED');
    }
  }
}

testErrorMessages().catch(console.error);
