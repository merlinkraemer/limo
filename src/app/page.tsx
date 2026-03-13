import { getAllLemonades } from '@/services/lemonade-service';
import { Leaderboard } from './components/Leaderboard';

export default async function HomePage() {
  const lemonades = await getAllLemonades();

  return (
    <main>
      <Leaderboard initialData={lemonades} />
      <footer className="site-footer">help us find the best lemonade ever pls 👉👈</footer>
    </main>
  );
}
