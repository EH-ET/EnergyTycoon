import { formatResourceValue } from './frontend-react/src/utils/bigValue.js';

const testCases = [
  { high: 0, data: 123000, expected: "123" },
  { high: 1, data: 123000, expected: "1.23K" },
  { high: 2, data: 123000, expected: "12.3K" },
  { high: 3, data: 123000, expected: "123K" },
  { high: 5, data: 123000, expected: "12.3M" },
  { high: 7, data: 123000, expected: "1.23B" },
  { high: 19, data: 123000, expected: "1.23Sx" },
  { high: 30, data: 123000, expected: "123N" },
  { high: 31, data: 123000, expected: "1.23d" },
  { high: 32, data: 123000, expected: "12.3d" },
  { high: 34, data: 123000, expected: "1.23Ud" },
  { high: 37, data: 123000, expected: "1.23Dd" },
  { high: 58, data: 123000, expected: "1.23Nd" },
  { high: 61, data: 123000, expected: "1.23V" },
  { high: 62, data: 123000, expected: "12.3V" },
  { high: 88, data: 123000, expected: "1.23Nv" },
  { high: 91, data: 123000, expected: "1.23Tr" },
  { high: 94, data: 123000, expected: "1.23UTr" },
  { high: 271, data: 123000, expected: "1.23Nv" },
  { high: 274, data: 123000, expected: "1.23UNv" },
  { high: 301, data: 123000, expected: "1.23C" },
  { high: 304, data: 123000, expected: "1.23CU" },
  { high: 331, data: 123000, expected: "1.23Cd" },
  { high: 361, data: 123000, expected: "1.23CV" },
  { high: 391, data: 123000, expected: "1.23CTr" },
  { high: 394, data: 123000, expected: "1.23CUTr" },
  { high: 601, data: 123000, expected: "1.23DC" },
  { high: 901, data: 123000, expected: "1.23TC" },
  { high: 3001, data: 123000, expected: "1.23Mi" },
  { high: 3004, data: 123000, expected: "1.23MiU" },
  { high: 3031, data: 123000, expected: "1.23Mid" },
  { high: 3034, data: 123000, expected: "1.23MiUd" },
  { high: 3301, data: 123000, expected: "1.23MiC" },
  { high: 3331, data: 123000, expected: "1.23MiCd" },
  { high: 3334, data: 123000, expected: "1.23MiCUd" },
  { high: 3634, data: 123000, expected: "1.23MiDCUd" },
  { high: 6001, data: 123000, expected: "1.23DMi" },
  { high: 30001, data: 123000, expected: "1.23dMi" },
  { high: 63001, data: 123000, expected: "1.23UVMi" },
  { high: 300_001, data: 123000, expected: "1.23CMi" },
  { high: 600_001, data: 123000, expected: "1.23DCMi" },
  { high: 630_001, data: 123000, expected: "1.23DCdMi" },
  { high: 633_001, data: 123000, expected: "1.23DCUdMi" },
  { high: 633_934, data: 123000, expected: "1.23DCUdMiTCUd" },
  { high: 3_000_001, data: 123000, expected: "1.23Mc" },
  { high: 3_003_001, data: 123000, expected: "1.23McMi" },
  { high: 3_006_001, data: 123000, expected: "1.23McDMi" },
  { high: 3_000_000_001, data: 123000, expected: "1.23Na" },
  { high: 3_000_000_000_001, data: 123000, expected: "1.23Pi" }
];

let passCount = 0;
let failCount = 0;
const failures = [];

console.log('BigValue Unit Test\n' + '='.repeat(80) + '\n');

testCases.forEach(({ high, data, expected }) => {
  const result = formatResourceValue({ data, high });
  const pass = result === expected;

  if (pass) {
    passCount++;
    console.log(`✓ PASS | high=${high.toString().padEnd(20)} | Expected: ${expected.padEnd(20)} | Got: ${result}`);
  } else {
    failCount++;
    failures.push({ high, expected, result });
    console.log(`✗ FAIL | high=${high.toString().padEnd(20)} | Expected: ${expected.padEnd(20)} | Got: ${result}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`Summary: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`);

if (failCount > 0) {
  console.log('\nFailed tests:');
  failures.forEach(({ high, expected, result }) => {
    console.log(`  high=${high}: expected "${expected}" but got "${result}"`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
}
