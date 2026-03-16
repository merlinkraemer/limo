import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Run via: infisical run --env=dev -- node scripts/supabase-check.mjs');
  process.exit(1);
}

const supabase = createClient(url, publishableKey, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.from('lemonades').select('id').limit(1);

if (error) {
  console.error('Supabase check failed:', error.message, error.code || '');
  process.exit(1);
}

console.log('Supabase check OK. lemonades table reachable.');
console.log('Sample rows:', data?.length ?? 0);
