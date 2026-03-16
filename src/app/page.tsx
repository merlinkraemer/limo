import { getAllLemonades } from '@/services/lemonade-service';
import { createClient } from '@/lib/supabase/server';
import { Leaderboard } from './components/Leaderboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [lemonades, supabase] = await Promise.all([
    getAllLemonades(),
    createClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user;

  return (
    <main>
      <Leaderboard initialData={lemonades} isAdmin={isAdmin} />
    </main>
  );
}
