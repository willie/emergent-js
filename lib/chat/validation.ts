import { z } from "zod";

// Define a schema for messages that allows for the flexibility of the AI SDK's UIMessage
const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "data", "tool"]),
  content: z.string().optional(),
  parts: z.array(z.any()).optional(), // Allow any structure for parts as they can be complex
}).passthrough();

// Define a schema for WorldState
// We validate the critical top-level fields and some nested structures to ensure type safety without being overly restrictive
const worldStateSchema = z.object({
  id: z.string(),
  scenario: z.object({
    title: z.string(),
    description: z.string(),
    // Allow other scenario fields
  }).passthrough(),
  time: z.object({
    tick: z.number(),
    narrativeTime: z.string(),
  }).passthrough(),
  characters: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    currentLocationClusterId: z.string(),
    isPlayer: z.boolean(),
    isDiscovered: z.boolean(),
    // Allow other character fields
  }).passthrough()),
  locationClusters: z.array(z.object({
    id: z.string(),
    canonicalName: z.string(),
    // Allow other fields
  }).passthrough()),
  locations: z.array(z.object({
      id: z.string(),
      // Allow other fields
  }).passthrough()),
  events: z.array(z.any()), // Just ensure it's an array
  conversations: z.array(z.any()), // Just ensure it's an array
  playerCharacterId: z.string(),
  mainConversationId: z.string(),
}).passthrough();

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  worldState: worldStateSchema,
  modelId: z.string().optional(),
});
