// Example file with implicit any in catch blocks

import { StellarAgent } from '../agent';

async function exampleTransaction() {
    const agent = new StellarAgent('testnet');
    
    try {
        const result = await agent.processAccount('GD1234567890abcdef');
        console.log('Balance:', result);
    } catch (error: unknown) {
        // FIXED: Explicit error typing with type guard
        if (error instanceof Error) {
            console.error('Transaction failed:', error.message);
        } else {
            console.error('Transaction failed with unknown error:', error);
        }
        throw error;
    }
}

async function exampleWithErrorHandling() {
    try {
        // Some operation that might fail
        const data = await fetch('https://api.stellar.org/accounts');
        const json = await data.json();
        return json;
    } catch (error: unknown) {
        // FIXED: Explicit error typing with type guard
        if (error instanceof Error) {
            console.error('Fetch error:', error.message);
        } else {
            console.error('Unknown error:', error);
        }
        throw error;
    }
}

export { exampleTransaction, exampleWithErrorHandling };
