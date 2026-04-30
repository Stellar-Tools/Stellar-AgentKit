// Problematic agent.ts with TypeScript compilation errors

// FIXED 1: Correct Server import from @stellar/stellar-sdk
import { Horizon } from '@stellar/stellar-sdk';
const { Server } = Horizon;

// FIXED 2: TS2367 non-overlapping string comparisons - added Network type union
type Network = 'mainnet' | 'testnet' | 'future';

function checkNetwork(network: Network): boolean {
    // FIXED: Now properly handles all Network types
    return network === 'mainnet' || network === 'testnet';
}

interface Balance {
    asset_type: string;
    balance: string;
    asset_code?: string;
    asset_issuer?: string;
}

interface AccountResponse {
    balances: Balance[];
}

async function getBalance(accountId: string): Promise<string> {
    const server = new Server('https://horizon-testnet.stellar.org');
    const account = await server.loadAccount(accountId) as AccountResponse;
    // FIXED: Explicit typing for balance
    const balance: Balance = account.balances[0];
    return balance.balance;
}

class StellarAgent {
    private server: Server;
    private network: Network;

    constructor(network: Network) {
        this.network = network;
        this.server = new Server(this.getHorizonUrl());
    }

    private getHorizonUrl(): string {
        // FIXED: Proper Network type handling with exhaustive check
        switch (this.network) {
            case 'mainnet':
                return 'https://horizon.stellar.org';
            case 'testnet':
                return 'https://horizon-testnet.stellar.org';
            case 'future':
                return 'https://horizon-futurenet.stellar.org';
            default:
                const _exhaustiveCheck: never = this.network;
                throw new Error(`Unsupported network: ${_exhaustiveCheck}`);
        }
    }

    async processAccount(accountId: string): Promise<string | null> {
        try {
            const account = await this.server.loadAccount(accountId) as AccountResponse;
            // FIXED: Explicit typing for balance with type guard
            const balance = account.balances.find((b: Balance) => b.asset_type === 'native');
            if (balance) {
                return balance.balance; // FIXED: Properly typed return value
            }
            return null;
        } catch (error) {
            console.error('Error processing account:', error);
            throw error;
        }
    }
}

export { StellarAgent, Network, Balance, AccountResponse, getBalance, checkNetwork };
