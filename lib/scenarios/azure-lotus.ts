import type { ScenarioConfig } from '@/types/world';

export const azureLotusScenario: ScenarioConfig = {
    title: 'The Azure Lotus',
    description: 'A hyper-exclusive eco-resort on a private island in the Andaman Sea. Surrounded by lush jungle and crystal-clear waters, it attracts the world\'s elite—and those who want something from them.',
    initialNarrativeTime: 'Sunset, Day 1',
    playerStartingLocation: 'Arrival Dock',
    locations: [
        {
            name: 'Arrival Dock',
            description: 'A long teakwood pier extending into turquoise waters. Seaplanes land here. A welcome pavilion offers chilled towels and champagne.'
        },
        {
            name: 'Lotus Lobby',
            description: 'The open-air main lobby with a soaring thatched roof, koi ponds, and designer furniture. The concierge desk is manned 24/7.'
        },
        {
            name: 'Infinity Pool',
            description: 'A massive infinity pool that seems to drop off into the ocean. Swim-up bar, private cabanas, and overly attentive waitstaff.'
        },
        {
            name: 'Jungle Villas',
            description: 'Luxurious private villas hidden deep in the foliage, connected by raised wooden walkways. Very private, very expensive.'
        },
        {
            name: 'Ancient Ruins',
            description: 'Crumbling stone structures from a forgotten civilization, overgrown with banyan roots. Located in the island\'s interior, off-limits to guests at night.'
        },
        {
            name: 'Underwater Observatory',
            description: 'A glass-walled lounge five meters below the surface. Blue light, vibrant coral reefs, and sharks gliding past the windows.'
        },
        {
            name: 'Staff Quarters',
            description: 'A restricted area behind the kitchen gardens. Concrete blocks, humming generators, and a very different vibe from the guest areas.'
        },
        {
            name: 'Helipad',
            description: 'A clearing on the highest peak. Windy and isolated.'
        }
    ],
    characters: [
        {
            name: 'You',
            description: 'A guest who just arrived. Your background is up to you.',
            isPlayer: true,
            initialLocationName: 'Arrival Dock',
            encounterChance: 1,
        },
        {
            name: 'Julian Vane',
            description: 'Tech billionaire and owner of the resort. Charming but intense. Obsessed with "optimizing human potential."',
            isPlayer: false,
            initialLocationName: 'Lotus Lobby',
            encounterChance: 0.9,
        },
        {
            name: 'Sienna Clark',
            description: 'A famous investigative journalist posing as a travel influencer. Always recording on her phone.',
            isPlayer: false,
            initialLocationName: 'Infinity Pool',
            encounterChance: 0.8,
        },
        {
            name: 'Dr. Aris Thorne',
            description: 'A disgraced archaeologist who now runs "historical tours" for the resort. Drunks too much.',
            isPlayer: false,
            initialLocationName: 'Ancient Ruins',
            encounterChance: 0.7,
        },
        {
            name: 'Kenji Sato',
            description: 'A high-stakes gambler and "import/export" businessman. Always surrounded by bodyguards (who are just background).',
            isPlayer: false,
            initialLocationName: 'Underwater Observatory',
            encounterChance: 0.6,
        },
        {
            name: 'Elara Vance',
            description: 'A reclusive A-list actress hiding from a scandal in Villa 4. Wears oversized sunglasses everywhere.',
            isPlayer: false,
            initialLocationName: 'Jungle Villas',
            encounterChance: 0.4,
        },
        {
            name: 'Kai',
            description: 'A local fisherman who works as a boat pilot. Knows every cave and current around the island.',
            isPlayer: false,
            initialLocationName: 'Arrival Dock',
            encounterChance: 0.8,
        },
        {
            name: 'Hotel Manager Benoit',
            description: 'Impeccably dressed, unflappable, and terrifyingly efficient. Sees everything.',
            isPlayer: false,
            initialLocationName: 'Lotus Lobby',
            encounterChance: 0.9,
        }
    ],
};
