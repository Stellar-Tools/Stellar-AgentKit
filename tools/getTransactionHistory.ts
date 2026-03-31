export async function getTransactionHistory(address: string) {
  try {
    const response = await fetch(
      `https://horizon.stellar.org/accounts/${address}/transactions`
    );

    const data = await response.json();

    return data._embedded.records.map((tx: any) => ({
      hash: tx.hash,
      created_at: tx.created_at,
      operation_count: tx.operation_count,
      memo: tx.memo,
    }));
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    throw new Error("Failed to fetch transaction history");
  }
}