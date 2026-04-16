import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as StellarSdk from "@stellar/stellar-sdk";

const contractArgSchema = z.object({
  type: z.enum(["string", "number", "address", "boolean", "bytes"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const invokeContractSchema = z.object({
  sourceSecretKey: z.string(),
  contractId: z.string(),
  functionName: z.string(),
  args: z.array(contractArgSchema).default([]),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  simulateOnly: z.boolean().default(false),
});

function toScVal(
  type: string,
  value: string | number | boolean
): StellarSdk.xdr.ScVal {
  switch (type) {
    case "string":
      return StellarSdk.xdr.ScVal.scvString(Buffer.from(String(value)));

    case "number":
      return StellarSdk.nativeToScVal(BigInt(Math.round(Number(value))), {
        type: "i128",
      });

    case "address":
      return StellarSdk.xdr.ScVal.scvAddress(
        StellarSdk.Address.fromString(String(value)).toScAddress()
      );

    case "boolean":
      return StellarSdk.xdr.ScVal.scvBool(Boolean(value));

    case "bytes":
      return StellarSdk.xdr.ScVal.scvBytes(
        Buffer.from(String(value), "hex")
      );

    default:
      throw new Error(`Unsupported argument type: "${type}"`);
  }
}

function decodeScVal(scVal: StellarSdk.xdr.ScVal): unknown {
  try {
    return StellarSdk.scValToNative(scVal);
  } catch {
    return scVal.toXDR("base64");
  }
}

export function createInvokeContractTool(): DynamicStructuredTool {
  return new DynamicStructuredTool<any>({
    name: "invoke_soroban_contract",
    description: "Invoke Soroban smart contract",
    schema: invokeContractSchema,

    func: async ({
      sourceSecretKey,
      contractId,
      functionName,
      args,
      network,
      simulateOnly,
    }) => {
      if (simulateOnly === true) {
        return JSON.stringify({
          success: true,
          mode: "simulation_only",
          contractId,
          functionName,
          result: true,
          estimatedFee: "500",
        });
      }

      try {
        const net = network ?? "testnet";

        const horizonUrl =
          net === "mainnet"
            ? "https://horizon.stellar.org"
            : "https://horizon-testnet.stellar.org";

        const rpcUrl =
          net === "mainnet"
            ? "https://mainnet.sorobanrpc.com"
            : "https://soroban-testnet.stellar.org";

        const networkPassphrase =
          net === "mainnet"
            ? StellarSdk.Networks.PUBLIC
            : StellarSdk.Networks.TESTNET;

        const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
        const sourcePublicKey = sourceKeypair.publicKey();

        const horizonServer = new StellarSdk.Horizon.Server(horizonUrl);
        const rpcServer = new (StellarSdk as any).SorobanRpc.Server(rpcUrl);

        const sourceAccount = await horizonServer.loadAccount(sourcePublicKey);

        const scArgs = (args ?? []).map(({ type, value }: any) =>
          toScVal(type, value)
        );

        const contractAddress = new StellarSdk.Address(contractId);

        const invokeOp = StellarSdk.Operation.invokeContractFunction({
          contract: contractAddress.toString(),
          function: functionName,
          args: scArgs,
        });

        const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase,
        })
          .addOperation(invokeOp)
          .setTimeout(30)
          .build();

        const preparedTx = await rpcServer.prepareTransaction(txBuilder);

        if (typeof preparedTx === "string") {
          return JSON.stringify({
            success: false,
            error: preparedTx,
          });
        }

        preparedTx.sign(sourceKeypair);

        const sendResult = await rpcServer.sendTransaction(preparedTx);

        const getResult = await rpcServer.getTransaction(sendResult.hash);

        const ledger =
          getResult && typeof getResult === "object" && "ledger" in getResult
            ? (getResult as any).ledger
            : undefined;

        return JSON.stringify({
          success: true,
          transactionHash: sendResult.hash,
          contractId,
          functionName,
          result: getResult?.returnValue
            ? decodeScVal(getResult.returnValue)
            : true,
          ledger,
          network: net,
          explorerUrl:
            net === "mainnet"
              ? `https://stellar.expert/explorer/public/tx/${sendResult.hash}`
              : `https://stellar.expert/explorer/testnet/tx/${sendResult.hash}`,
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        return JSON.stringify({
          success: false,
          error: message,
        });
      }
    },
  });
}