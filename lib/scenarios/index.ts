import { defaultScenario } from '@/lib/scenarios/default-scenario';
import { azureLotusScenario } from '@/lib/scenarios/azure-lotus';
import type { ScenarioConfig } from '@/types/world';

export const builtinScenarios: ScenarioConfig[] = [
    defaultScenario,
    azureLotusScenario,
];
