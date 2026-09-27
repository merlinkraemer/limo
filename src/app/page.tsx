import { getAllListingSummaries } from '@/services/listing-service';
import { LemoApp } from './components/LemoApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const listings = await getAllListingSummaries();

  return <LemoApp initialListings={listings} />;
}
