import { WorldProvider } from '@/components/world/WorldProvider';
import { GameLayout } from '@/components/world/GameLayout';

export default function Home() {
  return (
    <WorldProvider>
      <GameLayout />
    </WorldProvider>
  );
}
