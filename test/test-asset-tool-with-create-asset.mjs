import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { assetManagementTool } = await import('../dist/tools/assetManagement.js');

console.log("🧪 Testing get_balances...");
const balances = await assetManagementTool.invoke({
  action: "get_balances"
});
console.log("Balances:", balances);

console.log("\n🧪 Testing manage_trustline...");
const trustline = await assetManagementTool.invoke({
  action: "manage_trustline",
  assetCode: "USDC",
  assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  operation: "add"
});
console.log("Trustline:", trustline);

console.log("\n🧪 Testing create_asset...");
const created = await assetManagementTool.invoke({
  action: "create_asset",
  assetCode: "Murat",
  recipientAddress: process.env.STELLAR_PUBLIC_KEY,
  amount: "1000"
});
console.log("Created:", created);