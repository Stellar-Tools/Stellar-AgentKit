/**
 * Token Launch Usage Example
 * 
 * This example shows how to use the launchToken functionality
 * of the AgentClient class to create and launch a new token on Stellar.
 * 
 * ⚠️ IMPORTANT: This example is for testnet only.
 * Never use real mainnet secrets in examples or tests.
 */

import { AgentClient } from '../agent';
import { Keypair } from '@stellar/stellar-sdk';

async function exampleTokenLaunch() {
  console.log("🚀 Token Launch Example");
  console.log("=".repeat(50));

  try {
    // Initialize AgentClient for testnet
    const agent = new AgentClient({
      network: "testnet",
      // No allowMainnet flag needed for testnet
    });

    // Generate test keypairs (in real usage, you'd use existing funded accounts)
    const issuerKeypair = Keypair.random();
    const distributorKeypair = Keypair.random();

    console.log("Generated test accounts:");
    console.log(`Issuer Public Key: ${issuerKeypair.publicKey()}`);
    console.log(`Distributor Public Key: ${distributorKeypair.publicKey()}`);
    console.log("\n⚠️  Remember to fund these accounts on testnet before launching!");

    // Token launch parameters
    const launchParams = {
      code: "MYTOKEN",                    // Token symbol (1-12 characters)
      issuerSecret: issuerKeypair.secret(),     // Issuer account secret
      distributorSecret: distributorKeypair.secret(), // Distributor account secret
      initialSupply: "1000000.0000000",   // Initial token supply
      decimals: 7,                        // Stellar standard decimals (optional, defaults to 7)
      lockIssuer: false                   // Whether to lock issuer account (optional, defaults to false)
    };

    console.log("\nLaunching token with parameters:");
    console.log(`- Code: ${launchParams.code}`);
    console.log(`- Initial Supply: ${launchParams.initialSupply}`);
    console.log(`- Decimals: ${launchParams.decimals}`);
    console.log(`- Lock Issuer: ${launchParams.lockIssuer}`);

    // Launch the token
    const result = await agent.launchToken(launchParams);

    console.log("\n✅ Token launched successfully!");
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Asset Code: ${result.asset.code}`);
    console.log(`Asset Issuer: ${result.asset.issuer}`);
    console.log(`Distributor: ${result.distributorPublicKey}`);
    console.log(`Issuer Locked: ${result.issuerLocked}`);

  } catch (error) {
    console.error("\n❌ Token launch failed:");
    console.error(error.message);
  }
}

/**
 * Example with issuer locking (IRREVERSIBLE - use with extreme caution)
 */
async function exampleTokenLaunchWithLocking() {
  console.log("\n🔒 Token Launch with Issuer Locking Example");
  console.log("=".repeat(50));

  try {
    const agent = new AgentClient({
      network: "testnet"
    });

    // In real usage, these would be your funded accounts
    const issuerKeypair = Keypair.random();
    const distributorKeypair = Keypair.random();

    const launchParams = {
      code: "FIXEDTOKEN",
      issuerSecret: issuerKeypair.secret(),
      distributorSecret: distributorKeypair.secret(),
      initialSupply: "100000.0000000",
      decimals: 7,
      lockIssuer: true  // ⚠️ IRREVERSIBLE - locks the issuer account
    };

    // This will show a warning about issuer locking being irreversible
    const result = await agent.launchToken(launchParams);

    console.log("\n✅ Fixed-supply token launched successfully!");
    console.log(`The issuer account is now locked - no more tokens can be minted.`);
    console.log(`Transaction Hash: ${result.transactionHash}`);

  } catch (error) {
    console.error("\n❌ Token launch with locking failed:");
    console.error(error.message);
  }
}

/**
 * Security best practices example
 */
function securityBestPractices() {
  console.log("\n🛡️ Security Best Practices");
  console.log("=".repeat(50));
  
  console.log("✅ DO:");
  console.log("- Test thoroughly on testnet before mainnet use");
  console.log("- Use environment variables for secrets in production");
  console.log("- Validate all parameters before launching");
  console.log("- Fund issuer and distributor accounts before launching");
  console.log("- Understand that issuer locking is IRREVERSIBLE");
  
  console.log("\n❌ DON'T:");
  console.log("- Hard-code secret keys in your code");
  console.log("- Use mainnet for testing (launches are blocked by default)");
  console.log("- Lock issuer accounts without thorough testing");
  console.log("- Launch tokens without funding the required accounts first");
  console.log("- Log or expose secret keys anywhere");
}

// Display security best practices
securityBestPractices();

// Note: Uncomment to run examples (requires funded testnet accounts)
// exampleTokenLaunch();
// exampleTokenLaunchWithLocking();

export { exampleTokenLaunch, exampleTokenLaunchWithLocking, securityBestPractices };