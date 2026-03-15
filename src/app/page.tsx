import { getAllLemonades } from '@/services/lemonade-service';
import { Leaderboard } from './components/Leaderboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const lemonades = await getAllLemonades();

  return (
    <main>
      <Leaderboard initialData={lemonades} />
    </main>
  );
}
