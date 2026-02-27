/**
 * Test Runner - Executes all test files
 */

import { execSync } from "child_process";
import * as path from "path";

const testFiles = [
  "buildTransaction.test.ts",
  "tokenIssuance.test.ts",
  "getBalance.test.ts",
];

let totalPassed = 0;
let totalFailed = 0;

console.log("🚀 Running All Tests...\n");
console.log("=" .repeat(60));

testFiles.forEach((testFile, index) => {
  const testPath = path.join(__dirname, testFile);

  console.log(`\n[${index + 1}/${testFiles.length}] Running ${testFile}...`);
  console.log("-".repeat(60));

  try {
    const output = execSync(`npx ts-node "${testPath}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    console.log(output);

    // Parse results from output
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);

    if (passedMatch) totalPassed += parseInt(passedMatch[1]);
    if (failedMatch) totalFailed += parseInt(failedMatch[1]);

  } catch (error: any) {
    console.error(`❌ Test file ${testFile} failed to run:`);
    console.error(error.stdout || error.message);
    totalFailed++;
  }
});

console.log("\n" + "=".repeat(60));
console.log("\n📊 OVERALL TEST RESULTS\n");
console.log(`✅ Total Passed: ${totalPassed}`);
console.log(`❌ Total Failed: ${totalFailed}`);
console.log(`📈 Success Rate: ${totalPassed + totalFailed > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0}%`);

if (totalFailed > 0) {
  console.log("\n⚠️  Some tests failed. Please review the output above.\n");
  process.exit(1);
} else {
  console.log("\n🎉 All tests passed!\n");
  process.exit(0);
}
