import * as StellarSdk from "@stellar/stellar-sdk";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const SOROBAN_TESTNET = "https://soroban-testnet.stellar.org";

export type AssetInput =
  | { type: "native" }
  | { code: string; issuer: string };

export function resolveAsset(a: AssetInput): StellarSdk.Asset {
  if ("type" in a) return StellarSdk.Asset.native();
  return new StellarSdk.Asset(a.code, a.issuer);
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface SendPaymentParams {
  address: string;
  signXdr: (xdr: string) => Promise<string>;
  recipient: string;
  amount: string;
  asset?: { code: string; issuer: string };
}

export async function sendPayment(p: SendPaymentParams): Promise<string> {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(p.address)) {
    throw new Error("Invalid wallet address.");
  }
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(p.recipient)) {
    throw new Error("Invalid recipient address.");
  }
  if (!p.amount || isNaN(Number(p.amount)) || Number(p.amount) <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const server = new StellarSdk.Horizon.Server(HORIZON_TESTNET);
  const account = await server.loadAccount(p.address);

  const paymentAsset = p.asset
    ? new StellarSdk.Asset(p.asset.code, p.asset.issuer)
    : StellarSdk.Asset.native();

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: p.recipient,
        asset: paymentAsset,
        amount: p.amount,
      })
    )
    .setTimeout(300)
    .build();

  const signedXdr = await p.signXdr(tx.toXDR());
  const signedTx = new StellarSdk.Transaction(signedXdr, StellarSdk.Networks.TESTNET);
  const result = await server.submitTransaction(signedTx);
  if (!result.successful) {
    throw new Error(`Transaction failed (${result.hash})`);
  }
  return result.hash;
}

// ── DEX / Swap ────────────────────────────────────────────────────────────────

export interface RouteQuote {
  sendAmount: string;
  destAmount: string;
  path: AssetInput[];
  hopCount: number;
}

export async function quoteSwap(params: {
  mode: "strict-send" | "strict-receive";
  sendAsset: AssetInput;
  destAsset: AssetInput;
  sendAmount?: string;
  destAmount?: string;
  limit?: number;
}): Promise<RouteQuote[]> {
  const server = new StellarSdk.Horizon.Server(HORIZON_TESTNET);
  const sendAsset = resolveAsset(params.sendAsset);
  const destAsset = resolveAsset(params.destAsset);

  let records: any[];
  if (params.mode === "strict-send") {
    if (!params.sendAmount) throw new Error("strict-send için sendAmount gerekli.");
    const res = await server
      .strictSendPaths(sendAsset, params.sendAmount, [destAsset])
      .limit(params.limit ?? 5)
      .call();
    records = res.records;
  } else {
    if (!params.destAmount) throw new Error("strict-receive için destAmount gerekli.");
    const res = await server
      .strictReceivePaths([sendAsset], destAsset, params.destAmount)
      .limit(params.limit ?? 5)
      .call();
    records = res.records;
  }

  return records.map((r: any) => ({
    sendAmount: r.source_amount,
    destAmount: r.destination_amount,
    hopCount: (r.path ?? []).length,
    path: (r.path ?? []).map((p: any): AssetInput =>
      p.asset_type === "native"
        ? { type: "native" }
        : { code: p.asset_code, issuer: p.asset_issuer }
    ),
  }));
}

export async function executeSwap(params: {
  address: string;
  signXdr: (xdr: string) => Promise<string>;
  mode: "strict-send" | "strict-receive";
  sendAsset: AssetInput;
  destAsset: AssetInput;
  sendAmount?: string;
  destAmount?: string;
  slippageBps?: number;
  route?: RouteQuote;
}): Promise<string> {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.address)) {
    throw new Error("Invalid wallet address.");
  }

  const server = new StellarSdk.Horizon.Server(HORIZON_TESTNET);
  const sendAsset = resolveAsset(params.sendAsset);
  const destAsset = resolveAsset(params.destAsset);
  const slippage = (params.slippageBps ?? 100) / 10000;

  let best: RouteQuote;
  if (params.route) {
    best = params.route;
  } else {
    const quotes = await quoteSwap({
      mode: params.mode,
      sendAsset: params.sendAsset,
      destAsset: params.destAsset,
      sendAmount: params.sendAmount,
      destAmount: params.destAmount,
      limit: 1,
    });
    if (quotes.length === 0) throw new Error("No swap route found.");
    best = quotes[0];
  }

  const intermediatePath = best.path.map(resolveAsset);
  const account = await server.loadAccount(params.address);

  let operation;
  if (params.mode === "strict-send") {
    const destMin = (parseFloat(best.destAmount) * (1 - slippage)).toFixed(7);
    operation = StellarSdk.Operation.pathPaymentStrictSend({
      sendAsset,
      sendAmount: params.sendAmount!,
      destination: params.address,
      destAsset,
      destMin,
      path: intermediatePath,
    });
  } else {
    const sendMax = (parseFloat(best.sendAmount) * (1 + slippage)).toFixed(7);
    operation = StellarSdk.Operation.pathPaymentStrictReceive({
      sendAsset,
      sendMax,
      destination: params.address,
      destAsset,
      destAmount: params.destAmount!,
      path: intermediatePath,
    });
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  const signedXdr = await params.signXdr(tx.toXDR());
  const signedTx = new StellarSdk.Transaction(signedXdr, StellarSdk.Networks.TESTNET);
  const result = await server.submitTransaction(signedTx);
  if (!result.successful) {
    throw new Error(`Transaction failed (${result.hash})`);
  }
  return result.hash;
}

// ── Liquidity Pool (Soroban) ──────────────────────────────────────────────────

const DEFAULT_LP_CONTRACT = "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ";

export async function getLpReserves(
  address: string,
  contractAddress?: string
): Promise<{ reserveA: string; reserveB: string }> {
  const {
    Contract,
    rpc,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    scValToNative,
  } = StellarSdk;

  const contractId = contractAddress || DEFAULT_LP_CONTRACT;
  const server = new rpc.Server(SOROBAN_TESTNET, { allowHttp: false });

  const account = await server.getAccount(address);

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("get_reserves"))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(tx) as any;
  if (simulation.error) throw new Error(`Simulation error: ${simulation.error}`);

  const raw = scValToNative(simulation.result.retval) as [bigint, bigint];
  return {
    reserveA: raw[0].toString(),
    reserveB: raw[1].toString(),
  };
}

export async function lpDeposit(params: {
  address: string;
  signXdr: (xdr: string) => Promise<string>;
  to: string;
  desiredA: string;
  minA: string;
  desiredB: string;
  minB: string;
  contractAddress?: string;
}): Promise<string> {
  const {
    Contract,
    rpc,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    nativeToScVal,
    Address,
  } = StellarSdk;

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.address)) {
    throw new Error("Invalid wallet address.");
  }

  const contractId = params.contractAddress || DEFAULT_LP_CONTRACT;
  const server = new rpc.Server(SOROBAN_TESTNET, { allowHttp: false });
  const account = await server.getAccount(params.address);

  const contract = new Contract(contractId);
  const args = [
    nativeToScVal(new Address(params.address), { type: "address" }),
    nativeToScVal(new Address(params.to), { type: "address" }),
    nativeToScVal(BigInt(params.desiredA), { type: "i128" }),
    nativeToScVal(BigInt(params.minA), { type: "i128" }),
    nativeToScVal(BigInt(params.desiredB), { type: "i128" }),
    nativeToScVal(BigInt(params.minB), { type: "i128" }),
  ];

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("deposit", ...args))
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await params.signXdr(prepared.toXDR());
  const signedTx = new StellarSdk.Transaction(signedXdr, StellarSdk.Networks.TESTNET);
  const result = await server.sendTransaction(signedTx);
  return result.hash;
}

export async function lpWithdraw(params: {
  address: string;
  signXdr: (xdr: string) => Promise<string>;
  to: string;
  shareAmount: string;
  minA: string;
  minB: string;
  contractAddress?: string;
}): Promise<string> {
  const {
    Contract,
    rpc,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    nativeToScVal,
    Address,
  } = StellarSdk;

  if (!StellarSdk.StrKey.isValidEd25519PublicKey(params.address)) {
    throw new Error("Invalid wallet address.");
  }

  const contractId = params.contractAddress || DEFAULT_LP_CONTRACT;
  const server = new rpc.Server(SOROBAN_TESTNET, { allowHttp: false });
  const account = await server.getAccount(params.address);

  const contract = new Contract(contractId);
  const args = [
    nativeToScVal(new Address(params.address), { type: "address" }),
    nativeToScVal(new Address(params.to), { type: "address" }),
    nativeToScVal(BigInt(params.shareAmount), { type: "i128" }),
    nativeToScVal(BigInt(params.minA), { type: "i128" }),
    nativeToScVal(BigInt(params.minB), { type: "i128" }),
  ];

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("withdraw", ...args))
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await params.signXdr(prepared.toXDR());
  const signedTx = new StellarSdk.Transaction(signedXdr, StellarSdk.Networks.TESTNET);
  const result = await server.sendTransaction(signedTx);
  return result.hash;
}
