import { Horizon, TransactionBuilder, Operation, Networks } from "@stellar/stellar-sdk";

function getServer() {
  return new Horizon.Server(process.env.HORIZON_URL || "https://horizon-testnet.stellar.org");
}

export async function listClaimableBalances(publicKey: string) {
  const server = getServer();
  let response = await server.claimableBalances().claimant(publicKey).call();
  let allBalances = [...response.records];

  while (response.records.length > 0) {
    response = await response.next();
    allBalances.push(...response.records);
  }

  return allBalances.map((r: any) => ({
    id: r.id,
    asset: r.asset,
    amount: r.amount,
    sponsor: r.sponsor,
  }));
}

export async function claimBalance(publicKey: string, balanceId?: string) {
  const server = getServer();
  const account = await server.loadAccount(publicKey);
  const transaction = new TransactionBuilder(account, {
    fee: await server.fetchBaseFee(),
    networkPassphrase: process.env.STELLAR_NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
  });

  if (balanceId) {
    transaction.addOperation(Operation.claimClaimableBalance({ balanceId }));
  } else {
    const balances = await listClaimableBalances(publicKey);
    if (balances.length === 0) throw new Error("No claimable balances found.");
    
    balances.forEach((b: any) => {
      transaction.addOperation(Operation.claimClaimableBalance({ balanceId: b.id }));
    });
  }

  return transaction.setTimeout(30).build();
}
