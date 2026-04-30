#!/usr/bin/env node
/**
 * Runs E2E tests with local Supabase + Next.js.
 * Usage: node scripts/e2e-ci.mjs
 * Requires: supabase CLI, Docker (for supabase start)
 */
import { spawn, execSync } from 'child_process';

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
  const publishableKey = status.PUBLISHABLE_KEY || status.publishable_key || status.ANON_KEY || status.anon_key || '';
  const secretKey = status.SECRET_KEY || status.secret_key || status.service_role_key || status.SERVICE_ROLE_KEY || '';
  return {
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    secretKey,
  };
}

const TEST_ADMIN_EMAIL = 'e2e-admin@test.local';
const TEST_ADMIN_PASSWORD = 'e2e-admin-password';

async function createTestAdminUser(apiUrl, serviceRoleKey) {
  if (!serviceRoleKey) return false;
  const url = `${apiUrl.replace(/\/$/, '')}/auth/v1/admin/users`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
        email_confirm: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 422 && text.includes('already been registered')) return true;
      log(`  Admin user create: ${res.status} ${text}`, '\x1b[33m');
      return false;
    }
    return true;
  } catch (err) {
    log(`  Admin user create failed: ${err.message}`, '\x1b[33m');
    return false;
  }
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
  const env = getSupabaseEnv(status);
  Object.assign(process.env, env);
  process.env.PLAYWRIGHT_BASE_URL = BASE_URL;

  if (env.secretKey) {
    log('Creating test admin user...', '\x1b[36m');
    const created = await createTestAdminUser(env.NEXT_PUBLIC_SUPABASE_URL, env.secretKey);
    if (created) {
      process.env.TEST_ADMIN_EMAIL = TEST_ADMIN_EMAIL;
      process.env.TEST_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
      log('Test admin user ready', '\x1b[32m');
    }
  }

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
    ['playwright', 'test', '--project=chromium'],
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
