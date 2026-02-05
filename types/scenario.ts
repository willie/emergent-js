import { z } from 'zod';

export const InitialLocationSchema = z.object({
    name: z.string().min(1, "Location name is required"),
    description: z.string().min(1, "Location description is required"),
});

export const CharacterConfigSchema = z.object({
    name: z.string().min(1, "Character name is required"),
    description: z.string().min(1, "Character description is required"),
    isPlayer: z.boolean(),
    initialLocationName: z.string().min(1, "Initial location is required"),
    encounterChance: z.number().min(0).max(1),
    goals: z.string().optional(),
});

export const ScenarioSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    initialNarrativeTime: z.string().min(1, "Initial time is required"),
    locations: z.array(InitialLocationSchema).min(1, "At least one location is required"),
    characters: z.array(CharacterConfigSchema).min(1, "At least one character is required"),
    playerStartingLocation: z.string().min(1, "Player start location is required"),
});

export type ScenarioDefinition = z.infer<typeof ScenarioSchema>;
