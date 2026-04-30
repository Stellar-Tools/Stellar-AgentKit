// FIXED: String equivalence type errors with proper type guards
import { Transaction, Asset, Account, TransactionBuilder } from '@stellar/stellar-sdk';

type AssetType = 'native' | 'credit_alphanum4' | 'credit_alphanum12';

interface TransactionAsset {
    type: AssetType;
    code?: string;
    issuer?: string;
}

function buildPaymentOperation(from: string, to: string, asset: TransactionAsset, amount: string) {
    // FIXED: String equivalence type errors with exhaustive switch statement
    switch (asset.type) {
        case 'native':
            return {
                destination: to,
                asset: Asset.native(),
                amount: amount
            };
        case 'credit_alphanum4':
        case 'credit_alphanum12':
            if (!asset.code || !asset.issuer) {
                throw new Error('Credit asset requires code and issuer');
            }
            return {
                destination: to,
                asset: new Asset(asset.code, asset.issuer),
                amount: amount
            };
        default:
            // FIXED: TypeScript can now determine this is unreachable
            const _exhaustiveCheck: never = asset;
            throw new Error(`Unsupported asset type: ${_exhaustiveCheck}`);
    }
}

function validateAsset(asset: TransactionAsset): boolean {
    // FIXED: String equivalence type errors with proper type guards
    switch (asset.type) {
        case 'native':
            return true;
        case 'credit_alphanum4':
            return !!(asset.code && asset.code.length <= 4 && asset.issuer);
        case 'credit_alphanum12':
            return !!(asset.code && asset.code.length <= 12 && asset.issuer);
        default:
            // FIXED: TypeScript can now determine this is unreachable with type guard
            const _exhaustiveCheck: never = asset;
            return _exhaustiveCheck;
    }
}

interface PaymentOperation {
    destination: string;
    asset: Asset;
    amount: string;
}

function buildTransaction(sourceAccount: string, operations: PaymentOperation[]): Transaction {
    // FIXED: Type safety with proper typing for operations array
    const account = new Account(sourceAccount, '1');
    const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: 'Test SDF Network ; September 2015'
    });
    
    operations.forEach(op => transaction.addOperation(op));
    
    return transaction.build();
}

export { buildPaymentOperation, validateAsset, buildTransaction, TransactionAsset, AssetType, PaymentOperation };
