import { AgentClient } from "../index.js";

// Test simulation functionality
async function testSimulation() {
  console.log("🧪 Testing Stellar AgentKit Simulation Features\n");

  const agent = new AgentClient({
    network: "testnet",
    publicKey: process.env.STELLAR_PUBLIC_KEY || "GD5DJJBRB6A5QMFOGGGFOZPWKX2MLTWJKHPZJP6V6M7J5N54XTJYH"
  });

  try {
    // Test swap simulation
    console.log("1️⃣ Testing swap simulation...");
    const swapSim = await agent.simulate.swap({
      to: "GD5DJJBRB6A5QMFOGGGFOZPWKX2MLTWJKHPZJP6V6M7J5N54XTJYH",
      buyA: true,
      out: "100",
      inMax: "110"
    });
    console.log("Swap simulation result:", JSON.stringify(swapSim, null, 2));

    // Test LP deposit simulation
    console.log("\n2️⃣ Testing LP deposit simulation...");
    const depositSim = await agent.simulate.lp.deposit({
      to: "GD5DJJBRB6A5QMFOGGGFOZPWKX2MLTWJKHPZJP6V6M7J5N54XTJYH",
      desiredA: "1000",
      minA: "950",
      desiredB: "1000", 
      minB: "950"
    });
    console.log("LP deposit simulation result:", JSON.stringify(depositSim, null, 2));

    // Test bridge simulation
    console.log("\n3️⃣ Testing bridge simulation...");
    const bridgeSim = await agent.simulate.bridge({
      amount: "10",
      toAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      targetChain: "ethereum"
    });
    console.log("Bridge simulation result:", JSON.stringify(bridgeSim, null, 2));

    console.log("\n✅ All simulation tests completed successfully!");

  } catch (error) {
    console.error("❌ Simulation test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Run tests
testSimulation().catch(console.error);
