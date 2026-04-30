/**
 * Claimable Balance Usage Example
 *
 * Demonstrates the three claimable-balance flows exposed by AgentKit:
 *   1. create  — lock funds with a (possibly composite) claim predicate
 *   2. list    — discover open claimable balances for a recipient
 *   3. claim   — release the locked funds to the recipient
 *
 * Use cases this enables for AI agents:
 *   - Conditional payouts (only pay if X happens before deadline)
 *   - Vesting / scheduled payments
 *   - Two-party escrow (either party can claim before / after deadline)
 *
 * ⚠️ TESTNET ONLY. Never use mainnet secrets in examples.
 *
 * Account funding
 * ---------------
 * The example needs two funded testnet accounts. It supports two modes:
 *
 *   A. Set env vars (preferred for repeated runs):
 *        EXAMPLE_SOURCE_SECRET=S...
 *        EXAMPLE_RECIPIENT_SECRET=S...
 *      The accounts must already be funded on testnet.
 *
 *   B. Leave the env vars unset and the script will:
 *        - generate two fresh keypairs,
 *        - auto-fund them via the Friendbot faucet, and
 *        - print the secrets so you can re-use them on subsequent runs.
 *
 * Run with: ts-node examples/claimable-balance-example.ts
 */

import { AgentClient } from "../agent";
import { Horizon, Keypair } from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

/**
 * Resolve a keypair from an env var (preferred) or generate + fund a fresh one
 * via Friendbot. Verifies on-chain funding before returning so the rest of the
 * example can rely on the account existing.
 */
async function resolveAccount(
  label: string,
  envVar: string,
  server: Horizon.Server
): Promise<Keypair> {
  const fromEnv = process.env[envVar];
  if (fromEnv) {
    const kp = Keypair.fromSecret(fromEnv);
    await server.loadAccount(kp.publicKey()); // throws if not funded
    console.log(`  ✓ ${label}: ${kp.publicKey()} (from ${envVar})`);
    return kp;
  }

  const kp = Keypair.random();
  console.log(`  … ${label}: ${kp.publicKey()} (funding via Friendbot…)`);

  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(kp.publicKey())}`);
  if (!res.ok) {
    throw new Error(
      `Friendbot funding failed for ${label} (${res.status} ${res.statusText}). ` +
        `Set ${envVar} to a pre-funded testnet secret to skip Friendbot.`
    );
  }
  await server.loadAccount(kp.publicKey());
  console.log(`  ✓ ${label} funded. Save the secret to re-use on next run:`);
  console.log(`      export ${envVar}=${kp.secret()}`);
  return kp;
}

async function exampleClaimableBalances() {
  console.log("🔒 Claimable Balance Example");
  console.log("=".repeat(60));

  const agent = new AgentClient({ network: "testnet" });
  const server = new Horizon.Server(HORIZON_URL);

  console.log("\nResolving testnet accounts:");
  const source = await resolveAccount("source   ", "EXAMPLE_SOURCE_SECRET", server);
  const recipient = await resolveAccount("recipient", "EXAMPLE_RECIPIENT_SECRET", server);

  // ─── 1. Create ─────────────────────────────────────────────────────────
  // Lock 50 XLM for the recipient. Two layered conditions, expressed as a
  // composite predicate:
  //   - claimable for the next 24h (beforeRelativeTime: 86400s)
  //   - AND only after the configured "release time" has passed
  //     (i.e. NOT before that absolute timestamp)
  const releaseAtUnix = Math.floor(Date.now() / 1000) + 60; // 60s from now

  console.log("\nCreating claimable balance with composite predicate:");
  console.log(`  Amount:     50 XLM`);
  console.log(`  Window:     next 24h`);
  console.log(`  Earliest:   ${new Date(releaseAtUnix * 1000).toISOString()}`);

  const created = await agent.claimable.create({
    sourceSecret: source.secret(),
    asset: { code: "XLM" },
    amount: "50",
    claimants: [
      {
        destination: recipient.publicKey(),
        predicate: {
          type: "and",
          predicates: [
            { type: "beforeRelativeTime", seconds: 86400 },
            {
              type: "not",
              predicate: {
                type: "beforeAbsoluteTime",
                epochSeconds: releaseAtUnix,
              },
            },
          ],
        },
      },
    ],
  });

  console.log("\n✅ Created!");
  console.log(`  Tx hash:    ${created.transactionHash}`);
  console.log(`  Balance id: ${created.balanceIds[0]}`);

  // ─── 2. List ───────────────────────────────────────────────────────────
  console.log("\nListing open claimable balances for recipient...");
  const open = await agent.claimable.list({
    claimant: recipient.publicKey(),
  });
  console.log(`  Found ${open.length} balance(s).`);
  open.forEach((b) =>
    console.log(`    - ${b.id}  amount=${b.amount} asset=${b.asset}`)
  );

  // ─── 3. Claim ──────────────────────────────────────────────────────────
  // Wait until the predicate window opens, then claim. Horizon rejects claims
  // whose predicate is not yet satisfied with a descriptive error — we surface
  // that for visibility before retrying.
  const waitMs = Math.max(0, releaseAtUnix * 1000 - Date.now()) + 2_000;
  console.log(
    `\nWaiting ${Math.ceil(waitMs / 1000)}s for the predicate to open before claiming…`
  );
  await new Promise((r) => setTimeout(r, waitMs));

  try {
    const claimed = await agent.claimable.claim({
      claimerSecret: recipient.secret(),
      balanceId: created.balanceIds[0],
    });
    console.log(`✅ Claimed! Tx hash: ${claimed.transactionHash}`);
  } catch (err) {
    console.log(
      `❌ Claim failed: ${(err as Error).message}\n` +
        `   If the error is 'predicate not satisfied', the example may have been ` +
        `interrupted before the window opened — re-run to retry.`
    );
  }
}

exampleClaimableBalances().catch((err) => {
  console.error("Example failed:", err);
  process.exit(1);
});
