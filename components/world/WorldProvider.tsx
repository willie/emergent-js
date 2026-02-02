'use client';

import { useEffect, type ReactNode } from 'react';
import { useWorldStore } from '@/store/world-store';
import type { ScenarioConfig } from '@/types/world';

// Default scenario for testing
const defaultScenario: ScenarioConfig = {
  title: 'The Coffee Shop',
  description: 'A cozy afternoon at the local coffee shop.',
  initialNarrativeTime: 'Late afternoon',
  startingLocationName: 'Coffee Shop',
  startingLocationDescription: 'A warm, inviting coffee shop with the smell of fresh espresso in the air.',
  characters: [
    {
      name: 'You',
      description: 'The protagonist.',
      isPlayer: true,
      currentLocationClusterId: '', // Will be set
      encounterChance: 1,
    },
    {
      name: 'Maya',
      description: 'A regular at the coffee shop. Friendly, curious, always reading a thick novel.',
      isPlayer: false,
      currentLocationClusterId: '',
      encounterChance: 0.8,
    },
    {
      name: 'Alex',
      description: 'The barista. Dry sense of humor, knows everyone\'s usual order.',
      isPlayer: false,
      currentLocationClusterId: '',
      encounterChance: 0.9,
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
