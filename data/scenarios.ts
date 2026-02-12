import { ScenarioConfig } from '@/types/world';

export const builtinScenarios: ScenarioConfig[] = [
    {
        title: "Default Scenario",
        description: "A default scenario.",
        initialNarrativeTime: "Dawn",
        locations: [
            { name: "Town Square", description: "The center of the town." }
        ],
        characters: [
            {
                name: "Player",
                description: "The player.",
                isPlayer: true,
                initialLocationName: "Town Square",
                encounterChance: 1.0
            }
        ],
        playerStartingLocation: "Town Square"
    }
];
