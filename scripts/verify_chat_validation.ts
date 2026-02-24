import { chatRequestSchema } from '../lib/chat/validation';
import { z } from 'zod';

console.log("Starting verification...");

// Mock valid data
const validWorldState = {
  id: "world-1",
  scenario: {
    title: "Test Scenario",
    description: "A test scenario",
  },
  time: {
    tick: 100,
    narrativeTime: "Noon",
  },
  characters: [
    {
      id: "char-1",
      name: "Player",
      description: "The hero",
      currentLocationClusterId: "loc-1",
      isPlayer: true,
      isDiscovered: true,
    },
  ],
  locationClusters: [
    {
      id: "loc-1",
      canonicalName: "Town Square",
    },
  ],
  locations: [{ id: "l-1" }],
  events: [],
  conversations: [],
  playerCharacterId: "char-1",
  mainConversationId: "conv-1",
};

const validMessages = [
  { role: "user", content: "Hello" },
  { role: "assistant", content: "Hi", parts: [] },
];

async function runTests() {
  // Test 1: Valid Data
  const result1 = chatRequestSchema.safeParse({
    messages: validMessages,
    worldState: validWorldState,
    modelId: "gpt-4",
  });

  if (result1.success) {
    console.log("✅ Test 1 (Valid Data): Passed");
  } else {
    console.error("❌ Test 1 (Valid Data): Failed", result1.error);
    process.exit(1);
  }

  // Test 2: Invalid WorldState (Missing characters)
  const invalidWorldState = { ...validWorldState } as any;
  delete invalidWorldState.characters;

  const result2 = chatRequestSchema.safeParse({
    messages: validMessages,
    worldState: invalidWorldState,
  });

  if (!result2.success) {
    console.log("✅ Test 2 (Missing characters): Passed (Correctly rejected)");
  } else {
    console.error("❌ Test 2 (Missing characters): Failed (Should have rejected)");
    process.exit(1);
  }

  // Test 3: Invalid Messages (Not an array)
  const result3 = chatRequestSchema.safeParse({
    messages: "not-an-array",
    worldState: validWorldState,
  });

  if (!result3.success) {
    console.log("✅ Test 3 (Invalid messages): Passed (Correctly rejected)");
  } else {
    console.error("❌ Test 3 (Invalid messages): Failed (Should have rejected)");
    process.exit(1);
  }

  // Test 4: Invalid Role
  const invalidMessages = [{ role: "hacker", content: "bad" }];

  const result4 = chatRequestSchema.safeParse({
    messages: invalidMessages,
    worldState: validWorldState,
  });

  if (!result4.success) {
    console.log("✅ Test 4 (Invalid role): Passed (Correctly rejected)");
  } else {
    console.error("❌ Test 4 (Invalid role): Failed (Should have rejected)");
    process.exit(1);
  }
}

runTests();
