#!/usr/bin/env node
import { Keypair } from "@stellar/stellar-sdk";

(async () => {
  const args = process.argv.slice(2);
  const fund = args.includes("--fund") || args.includes("-f");

  const kp = Keypair.random();
  const pub = kp.publicKey();
  const sec = kp.secret();

  console.log("--- Stellar Wallet Generated ---");
  console.log("Public Key:", pub);
  console.log("Secret Key:", sec);

  if (fund) {
    // Ensure fetch is available (Node 18+ has global fetch). Try to dynamically import undici if needed.
    if (typeof fetch !== "function") {
      try {
        const undici = await import("undici");
        globalThis.fetch = undici.fetch;
      } catch (err) {
        console.error("No global fetch and failed to import undici. Skipping funding.", err.message || err);
        process.exit(0);
      }
    }

    const url = `https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`;
    console.log("Requesting Friendbot to fund testnet account...");
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        console.error("Friendbot error", res.status, text);
      } else {
        console.log("Friendbot response:", text);
      }
    } catch (err) {
      console.error("Friendbot request failed:", err.message || err);
    }
  } else {
    console.log("Run with --fund (or -f) to request testnet funds via Friendbot.");
  }
})();
