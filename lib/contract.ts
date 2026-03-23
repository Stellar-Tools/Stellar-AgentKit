import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "stellar-sdk";

import { signTransaction } from "./stellar";
import { buildTransaction } from "../utils/buildTransaction";

const rpcUrl = "https://soroban-testnet.stellar.org";
const contractAddress =
  "CCUMBJFVC3YJOW3OOR6WTWTESH473ZSXQEGYPQDWXAYYC4J77OT4NVHJ";
const networkPassphrase = Networks.TESTNET;

type ContractArg = xdr.ScVal;
type ContractArgs = ContractArg | ContractArg[] | null;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const addressToScVal = (address: string): xdr.ScVal => {
  if (!/^[CG][A-Z0-9]{55}$/.test(address)) {
    throw new Error(`Invalid address format: ${address}`);
  }

  return nativeToScVal(new Address(address), { type: "address" });
};

const numberToI128 = (value: string | bigint): xdr.ScVal => {
  return nativeToScVal(typeof value === "string" ? BigInt(value) : value, {
    type: "i128",
  });
};

const booleanToScVal = (value: boolean): xdr.ScVal => {
  return nativeToScVal(value, { type: "bool" });
};

const toArgsArray = (values: ContractArgs): xdr.ScVal[] | undefined => {
  if (values == null) return undefined;
  return Array.isArray(values) ? values : [values];
};

const contractInt = async (
  caller: string,
  functionName: string,
  values: ContractArgs
): Promise<unknown> => {
  const server = new rpc.Server(rpcUrl, { allowHttp: true });
  const contract = new Contract(contractAddress);

  try {
    const sourceAccount = await server.getAccount(caller).catch(
      (error: unknown) => {
        throw new Error(
          `Failed to fetch account ${caller}: ${getErrorMessage(error)}`
        );
      }
    );

    const transaction = buildTransaction("lp", sourceAccount, {
      contract,
      functionName,
      args: toArgsArray(values),
    });

    const simulation = await server.simulateTransaction(transaction).catch(
      (error: unknown) => {
        throw new Error(
          `Failed to simulate transaction: ${getErrorMessage(error)}`
        );
      }
    );

    if (
      "results" in simulation &&
      Array.isArray(simulation.results) &&
      simulation.results.length > 0
    ) {
      const result = simulation.results[0];

      if (!result.xdr) {
        throw new Error("No return value in simulation results");
      }

      const scVal = xdr.ScVal.fromXDR(result.xdr, "base64");
      return scValToNative(scVal);
    }

    if ("error" in simulation) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    const preparedTx = await server.prepareTransaction(transaction).catch(
      (error: unknown) => {
        throw new Error(
          `Failed to prepare transaction: ${getErrorMessage(error)}`
        );
      }
    );

    const signedXdr = signTransaction(preparedTx.toXDR(), networkPassphrase);
    const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);

    const txResult = await server.sendTransaction(tx).catch(
      (error: unknown) => {
        throw new Error(`Send transaction failed: ${getErrorMessage(error)}`);
      }
    );

    let txResponse = await server.getTransaction(txResult.hash);
    let retries = 0;

    while (txResponse.status === "NOT_FOUND" && retries < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      txResponse = await server.getTransaction(txResult.hash);
      retries++;
    }

    if (txResponse.status === "NOT_FOUND") {
      return {
        hash: txResult.hash,
        status: "PENDING",
      };
    }

    if (txResponse.status !== "SUCCESS") {
      throw new Error(`Transaction failed: ${txResponse.status}`);
    }

    if (txResponse.returnValue) {
      return scValToNative(txResponse.returnValue);
    }

    return null;
  } catch (error: unknown) {
    throw new Error(
      `Error in contract interaction (${functionName}): ${getErrorMessage(error)}`
    );
  }
};

export async function getShareId(caller: string): Promise<string | null> {
  const result = await contractInt(caller, "share_id", null);
  return result ? (result as string) : null;
}

export async function deposit(
  caller: string,
  to: string,
  desiredA: string,
  minA: string,
  desiredB: string,
  minB: string
): Promise<void> {
  await contractInt(caller, "deposit", [
    addressToScVal(to),
    numberToI128(desiredA),
    numberToI128(minA),
    numberToI128(desiredB),
    numberToI128(minB),
  ]);
}

export async function swap(
  caller: string,
  to: string,
  buyA: boolean,
  out: string,
  inMax: string
): Promise<void> {
  await contractInt(caller, "swap", [
    addressToScVal(to),
    booleanToScVal(buyA),
    numberToI128(out),
    numberToI128(inMax),
  ]);
}

export async function withdraw(
  caller: string,
  to: string,
  shareAmount: string,
  minA: string,
  minB: string
): Promise<readonly [bigint, bigint] | null> {
  const result = await contractInt(caller, "withdraw", [
    addressToScVal(to),
    numberToI128(shareAmount),
    numberToI128(minA),
    numberToI128(minB),
  ]);

  return result ? (result as [bigint, bigint]) : null;
}

export async function getReserves(
  caller: string
): Promise<readonly [bigint, bigint] | null> {
  const result = await contractInt(caller, "get_rsrvs", null);
  return result ? (result as [bigint, bigint]) : null;
}