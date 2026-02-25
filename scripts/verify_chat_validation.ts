
import { ChatRequestSchema } from '@/lib/chat/validation';

console.log("Starting Validation Verification...");

// 1. Valid Request
const validRequest = {
  messages: [{ role: 'user', content: 'Hello' }],
  worldState: {
    characters: [],
    playerCharacterId: 'p1',
    locationClusters: [],
    events: [],
    scenario: { description: 'Test Scenario' },
    time: { narrativeTime: 'Now', tick: 1 },
  },
  modelId: 'openai/gpt-oss-120b:exacto', // Use a valid model from list
};

const result1 = ChatRequestSchema.safeParse(validRequest);
if (result1.success) {
  console.log("✅ Valid Request passed");
} else {
  console.error("❌ Valid Request failed:", result1.error);
  process.exit(1);
}

// 2. Invalid Request: Missing World State fields
const invalidWorldState = {
  messages: [{ role: 'user', content: 'Hello' }],
  worldState: {
    // Missing characters, etc.
    scenario: { description: 'Test' },
  },
};

const result2 = ChatRequestSchema.safeParse(invalidWorldState);
if (!result2.success) {
  console.log("✅ Invalid World State correctly rejected");
} else {
  console.error("❌ Invalid World State accepted unexpectedly");
  process.exit(1);
}

// 3. Invalid Request: Invalid Model ID
const invalidModel = {
  ...validRequest,
  modelId: 'bad-model',
};

const result3 = ChatRequestSchema.safeParse(invalidModel);
if (!result3.success) {
  console.log("✅ Invalid Model ID correctly rejected");
} else {
  console.error("❌ Invalid Model ID accepted unexpectedly");
  process.exit(1);
}

// 4. Invalid Request: Malformed Messages
const invalidMessages = {
    ...validRequest,
    messages: "Not an array",
};

const result4 = ChatRequestSchema.safeParse(invalidMessages);
if (!result4.success) {
    console.log("✅ Invalid Messages correctly rejected");
} else {
    console.error("❌ Invalid Messages accepted unexpectedly");
    process.exit(1);
}

console.log("All validation tests passed!");
