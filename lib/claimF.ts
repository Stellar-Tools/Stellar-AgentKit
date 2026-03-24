import { Horizon, TransactionBuilder, Operation, Networks } from "@stellar/stellar-sdk";

function getServer() {
  return new Horizon.Server(process.env.HORIZON_URL || "https://horizon-testnet.stellar.org");
}

export async function listClaimableBalances(publicKey: string) {
  const server = getServer();
  let response = await server.claimableBalances().claimant(publicKey).call();
  let allBalances = [...response.records];

  // Sayfalama (Pagination) döngüsü: Tüm kayıtları çeker
  while (response.records.length > 0) {
    try {
      response = await response.next();
      if (response.records.length > 0) {
        allBalances.push(...response.records);
      }
    } catch (e) {
      // Daha fazla sayfa yoksa döngüden çık
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
  const server = getServer();
  const account = await server.loadAccount(publicKey);

  // Hata veren 'fee' kısmı string'e çevrildi ve yapı düzeltildi
  const baseFee = await server.fetchBaseFee();

  const transaction = new TransactionBuilder(account, {
    fee: baseFee.toString(), // Sayı olan fee değerini string yaparak hatayı çözdük
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