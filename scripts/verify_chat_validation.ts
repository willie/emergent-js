import { ChatRequestSchema } from "../lib/chat/validation";

function runTests() {
  console.log("🛡️ Running Chat Validation Tests...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Test 1: Valid payload
  const validPayload = {
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" }
    ],
    worldState: {
      some: "state",
      other: 123
    },
    modelId: "gpt-4",
    lastSimulationTick: 100
  };

  const result1 = ChatRequestSchema.safeParse(validPayload);
  assert(result1.success, "Valid payload should pass");

  // Test 2: Missing messages
  const missingMessages = {
    worldState: {}
  };
  const result2 = ChatRequestSchema.safeParse(missingMessages);
  assert(!result2.success, "Missing messages should fail");

  // Test 3: Invalid messages type
  const invalidMessages = {
    messages: "not an array",
    worldState: {}
  };
  const result3 = ChatRequestSchema.safeParse(invalidMessages);
  assert(!result3.success, "Invalid messages type should fail");

  // Test 4: Messages missing content
  const messagesMissingContent = {
    messages: [{ role: "user" }],
    worldState: {}
  };
  const result4 = ChatRequestSchema.safeParse(messagesMissingContent);
  assert(!result4.success, "Messages missing content should fail");

  // Test 5: Missing worldState
  const missingWorldState = {
    messages: [{ role: "user", content: "Hi" }]
  };
  const result5 = ChatRequestSchema.safeParse(missingWorldState);
  assert(!result5.success, "Missing worldState should fail");

  console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
