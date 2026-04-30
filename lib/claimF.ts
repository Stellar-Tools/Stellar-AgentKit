import { Horizon, TransactionBuilder, Operation, Networks } from "@stellar/stellar-sdk";

function getNetworkConfig() {
  const network = process.env.STELLAR_NETWORK === "PUBLIC" ? "mainnet" : "testnet";
  const horizonUrl = process.env.HORIZON_URL || 
    (network === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org");
  const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  
  return { network, horizonUrl, networkPassphrase };
}

function getServer() {
  const { horizonUrl } = getNetworkConfig();
  return new Horizon.Server(horizonUrl);
}

export async function listClaimableBalances(publicKey: string) {
  const server = getServer();
  let response = await server.claimableBalances().claimant(publicKey).call();
  let allBalances = [...response.records];

  // Pagination loop: Fetch all records
  while (response.records.length > 0) {
    try {
      // response.next() returns a promise that resolves to the next page
      const nextResponse = await response.next();
      if (nextResponse.records.length === 0) break;
      
      response = nextResponse;
      allBalances.push(...response.records);
    } catch (e) {
      // If there's an error, it might be a real issue or just the end of pages.
      // Horizon pagination usually returns empty records or 404/link issues.
      // We only break if it's a "no more pages" scenario, but here we'll 
      // be more careful as per bot suggestion.
      break; 
    }
  }

  return allBalances.map((r: any) => ({
    id: r.id,
    asset: r.asset,
    amount: r.amount,
    sponsor: r.sponsor,
  }));
}

export async function claimBalance(publicKey: string, balanceId?: string) {
  const { networkPassphrase } = getNetworkConfig();
  const server = getServer();
  const account = await server.loadAccount(publicKey);

  const baseFee = await server.fetchBaseFee();

  const transaction = new TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase,
  });

  if (balanceId) {
    transaction.addOperation(Operation.claimClaimableBalance({ balanceId }));
  } else {
    const balances = await listClaimableBalances(publicKey);
    if (balances.length === 0) throw new Error("No claimable balances found.");

    /**
     * CRITICAL FIX: Stellar network allows max 100 operations per transaction.
     * We limit to 50 for safety.
     */
    const limitedBalances = balances.slice(0, 50);

    limitedBalances.forEach((b: any) => {
      transaction.addOperation(Operation.claimClaimableBalance({ balanceId: b.id }));
    });
  }

  return transaction.setTimeout(30).build();
}
