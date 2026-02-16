import type { UIMessage } from "@ai-sdk/react";

export interface StateDelta {
  timeAdvance?: { ticks: number; narrativeTime?: string };
  movement?: {
    destination: string;
    resolvedClusterId: string;
    isNewCluster: boolean;
    newClusterName?: string;
    previousClusterId?: string;
    accompaniedCharacterIds?: string[];
  };
  discoveries?: Array<{
    characterName: string;
    matchedCharacterId: string | null;
    introduction: string;
    goals?: string;
  }>;
  simulationNeeded?: boolean;
}

export interface GameMessageMetadata {
  stateDelta?: StateDelta;
}

export type GameMessage = UIMessage<GameMessageMetadata>;
