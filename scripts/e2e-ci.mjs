#!/usr/bin/env node
/**
 * Runs E2E tests with local Supabase + Next.js.
 * Usage: node scripts/e2e-ci.mjs
 * Requires: supabase CLI, Docker (for supabase start), psql (postgresql-client;
 * used only for the local Storage upsert-index repair below)
 */
import { spawn, execSync, execFileSync } from 'child_process';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function log(msg, color = '\x1b[0m') {
  console.log(`${color}${msg}\x1b[0m`);
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts });
}

function isSupabaseRunning() {
  try {
    const out = exec('supabase status 2>/dev/null');
    return out.includes('API URL') || out.includes('api_url');
  } catch {
    return false;
  }
}

function startSupabase() {
  log('Starting Supabase...', '\x1b[36m');
  try {
    exec('supabase start', { stdio: 'inherit' });
    return true;
  } catch {
    log('Failed to start Supabase', '\x1b[31m');
    return false;
  }
}

function parseStatusEnv(envOut) {
  const status = {};
  for (const line of envOut.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m) status[m[1]] = m[2];
  }
  return status;
}

function waitForSupabase(maxAttempts = 30) {
  log('Waiting for Supabase to be ready...', '\x1b[33m');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      let status = {};
      try {
        const jsonOut = exec('supabase status -o json 2>/dev/null');
        status = JSON.parse(jsonOut);
      } catch {
        const envOut = exec('supabase status -o env 2>/dev/null');
        status = parseStatusEnv(envOut);
      }
      const apiUrl = status.API_URL || status.api_url;
      if (apiUrl) {
        log('Supabase is ready', '\x1b[32m');
        return status;
      }
    } catch {}
    if (i < maxAttempts - 1) {
      process.stdout.write(`  Attempt ${i + 1}/${maxAttempts}...\r`);
      execSync('sleep 2', { stdio: 'inherit' });
    }
  }
  throw new Error('Supabase did not become ready');
}

function getSupabaseEnv(status) {
  const apiUrl = status.API_URL || status.api_url || 'http://127.0.0.1:54321';
  const anonKey = status.ANON_KEY || status.anon_key || '';
  const serviceRoleKey = status.SERVICE_ROLE_KEY || status.service_role_key || '';
  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };
}

/**
 * Local-test-only repair for the storage-api version pinned by Supabase CLI
 * 2.118.0 (storage-api v1.44.11).
 *
 * `supabase db reset` restarts the Storage container, which re-runs the
 * image's bundled migrations. Migration `drop-bucketid-objname-index` drops
 * the legacy unique index on `storage.objects (bucket_id, name)`, but the same
 * image still upserts objects with `ON CONFLICT ("name", "bucket_id")`. The
 * remaining unique indexes are partial or include `version`, so Postgres
 * cannot infer a conflict arbiter and every Storage upload fails with 42P10
 * (which breaks the photo E2E tests). Recreate the legacy unique index in the
 * local test database only; `supabase/migrations/**` and the hosted /
 * production schema are intentionally untouched.
 */
function repairStorageUpsertIndex(status) {
  const dbUrl = new URL(status.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  // The local `postgres` role is not a superuser and does not own
  // storage.objects; `supabase_storage_admin` is the owning role.
  dbUrl.username = 'supabase_storage_admin';
  const sql =
    'CREATE UNIQUE INDEX IF NOT EXISTS objects_bucketId_name_key ON storage.objects (bucket_id, name);';

  log('Repairing local Storage upsert index (storage-api v1.44.11 mismatch)...', '\x1b[33m');
  try {
    execFileSync('psql', [dbUrl.toString(), '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], {
      stdio: 'inherit',
    });
  } catch (err) {
    log(
      [
        'Local Storage repair failed:',
        "`npm run test:e2e` needs psql (postgresql-client) on PATH, Docker running,",
        'and the `supabase_storage_admin` role available after `supabase db reset`.',
        `Underlying error: ${err.message}`,
      ].join(' '),
      '\x1b[31m'
    );
    process.exit(1);
  }

  const indexDef = execFileSync(
    'psql',
    [
      dbUrl.toString(),
      '-tAc',
      "select indexdef from pg_indexes where schemaname = 'storage' and tablename = 'objects' and indexname = 'objects_bucketid_name_key'",
    ],
    { encoding: 'utf8' }
  ).trim();
  if (!/UNIQUE INDEX/i.test(indexDef) || !/\(bucket_id, name\)/.test(indexDef) || /WHERE/i.test(indexDef)) {
    log(`Local Storage repair did not produce the expected unique index (got: ${indexDef || 'nothing'})`, '\x1b[31m');
    process.exit(1);
  }
  log('Storage upsert index repaired', '\x1b[32m');
}

function waitForServer(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {}
      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error(`Server at ${url} did not become ready`));
        return;
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

async function main() {
  log('\nE2E Test Runner\n', '\x1b[36m');

  if (!isSupabaseRunning()) {
    if (!startSupabase()) process.exit(1);
  } else {
    log('Supabase already running', '\x1b[32m');
  }

  const status = waitForSupabase();
  log('Applying migrations...', '\x1b[36m');
  exec('supabase db reset --no-seed', { stdio: 'inherit' });
  repairStorageUpsertIndex(status);
  const env = getSupabaseEnv(status);
  Object.assign(process.env, env);
  process.env.PLAYWRIGHT_BASE_URL = BASE_URL;

  log(`Starting Next.js on port ${PORT}...`, '\x1b[36m');
  const nextProcess = spawn('npm', ['run', 'dev:next', '--', '--port', String(PORT)], {
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
  });

  nextProcess.stdout?.on('data', (d) => {
    if (d.toString().includes('Ready') || d.toString().includes('started')) {
      log('Next.js is ready', '\x1b[32m');
    }
  });

  try {
    await waitForServer(BASE_URL);
  } catch (err) {
    log(err.message, '\x1b[31m');
    nextProcess.kill('SIGTERM');
    process.exit(1);
  }

  log('Running Playwright tests...', '\x1b[36m');
  const playwright = spawn(
    'npx',
    ['playwright', 'test'],
    {
      stdio: 'inherit',
      env: { ...process.env, CI: '1', PLAYWRIGHT_BASE_URL: BASE_URL },
      cwd: process.cwd(),
    }
  );

  const exitCode = await new Promise((resolve) => {
    playwright.on('close', resolve);
  });

  nextProcess.kill('SIGTERM');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
