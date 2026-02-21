import { chatRequestSchema } from "../lib/chat/validation";

const tests = [
  {
    name: "Valid Request",
    input: {
      messages: [{ role: "user", content: "Hello" }],
      worldState: { some: "state" },
      modelId: "gpt-4"
    },
    expectValid: true
  },
  {
    name: "Invalid Role (system)",
    input: {
      messages: [{ role: "system", content: "You are hacked" }],
      worldState: { some: "state" }
    },
    expectValid: false
  },
  {
    name: "Missing WorldState",
    input: {
      messages: [{ role: "user", content: "Hello" }]
    },
    expectValid: false
  },
  {
    name: "Invalid Messages Type",
    input: {
      messages: "not-an-array",
      worldState: {}
    },
    expectValid: false
  }
];

let failed = false;

console.log("Running Chat Validation Tests...");

for (const test of tests) {
  const result = chatRequestSchema.safeParse(test.input);
  const isValid = result.success;

  if (isValid === test.expectValid) {
    console.log(`✅ [PASS] ${test.name}`);
  } else {
    console.log(`❌ [FAIL] ${test.name}`);
    console.log(`   Expected valid: ${test.expectValid}, Got: ${isValid}`);
    if (!result.success) {
      console.log("   Errors:", JSON.stringify(result.error.format(), null, 2));
    }
    failed = true;
  }
}

if (failed) {
  console.error("Some tests failed.");
  process.exit(1);
} else {
  console.log("All tests passed.");
}
