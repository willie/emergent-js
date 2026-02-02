'use client';

import { useEffect, type ReactNode } from 'react';
import { useWorldStore } from '@/store/world-store';
import type { ScenarioConfig } from '@/types/world';

// Default scenario for testing - a small town with multiple locations
const defaultScenario: ScenarioConfig = {
  title: 'The Quiet Town',
  description: 'A sleepy afternoon in a small town. People go about their business, unaware of the secrets that lurk beneath the surface.',
  initialNarrativeTime: 'Late afternoon',
  locations: [
    { name: 'Coffee Shop', description: 'A warm, inviting coffee shop with the smell of fresh espresso.' },
    { name: 'Town Square', description: 'The central plaza with a fountain and benches under old oak trees.' },
    { name: 'Library', description: 'A quiet library with tall bookshelves and dusty reading nooks.' },
    { name: 'Back Alley', description: 'A narrow alley behind the main street, shadowy and rarely visited.' },
  ],
  playerStartingLocation: 'Coffee Shop',
  characters: [
    {
      name: 'You',
      description: 'A newcomer to this town, curious about its inhabitants.',
      isPlayer: true,
      initialLocationName: 'Coffee Shop',
      encounterChance: 1,
    },
    {
      name: 'Maya',
      description: 'A regular at the coffee shop. Friendly but secretive, always reading thick novels with strange titles.',
      isPlayer: false,
      initialLocationName: 'Coffee Shop',
      encounterChance: 0.9,
    },
    {
      name: 'Alex',
      description: 'The barista. Dry sense of humor, seems to know more about the town than they let on.',
      isPlayer: false,
      initialLocationName: 'Coffee Shop',
      encounterChance: 0.9,
    },
    {
      name: 'Marcus',
      description: 'An old man who sits on a bench in the square. Former mayor, now talks to pigeons.',
      isPlayer: false,
      initialLocationName: 'Town Square',
      encounterChance: 0.8,
    },
    {
      name: 'Elena',
      description: 'The stern librarian. Has worked here for 40 years. Keeps a locked room in the basement.',
      isPlayer: false,
      initialLocationName: 'Library',
      encounterChance: 0.7,
    },
    {
      name: 'Jay',
      description: 'A nervous young person who seems to be hiding from something. Often found in unlikely places.',
      isPlayer: false,
      initialLocationName: 'Back Alley',
      encounterChance: 0.5,
    },
  ],
};

interface WorldProviderProps {
  children: ReactNode;
  scenario?: ScenarioConfig;
}

export function WorldProvider({ children, scenario = defaultScenario }: WorldProviderProps) {
  const world = useWorldStore((s) => s.world);
  const initializeScenario = useWorldStore((s) => s.initializeScenario);

  useEffect(() => {
    if (!world) {
      initializeScenario(scenario);
    }
  }, [world, scenario, initializeScenario]);

  if (!world) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        Loading world...
      </div>
    );
  }

  return <>{children}</>;
}
