#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return false;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

async function checkSupabaseConnection(maxRetries = 30) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) return false;
  
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { error } = await supabase.from('lemonades').select('id').limit(1);
      if (!error) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function isSupabaseRunning() {
  try {
    const result = execSync('supabase status 2>/dev/null', { encoding: 'utf8' });
    return result.includes('API URL');
  } catch {
    return false;
  }
}

function startSupabase() {
  log('\n🔄 Starting Supabase...', CYAN);
  try {
    execSync('supabase start', { stdio: 'inherit' });
    return true;
  } catch {
    log('❌ Failed to start Supabase', RED);
    return false;
  }
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  log('\n🚀 Limo Dev Environment\n', CYAN);
  
  // Load env
  if (!loadEnvFile()) {
    log('❌ No .env.local found. Run "supabase start" first to get credentials.', RED);
    process.exit(1);
  }
  
  // Check/start Supabase
  if (!isSupabaseRunning()) {
    if (!startSupabase()) {
      process.exit(1);
    }
    // Reload env after Supabase start
    loadEnvFile();
  } else {
    log('✅ Supabase already running', GREEN);
  }
  
  // Wait for Supabase to be ready
  log('⏳ Waiting for Supabase to be ready...', YELLOW);
  const supabaseReady = await checkSupabaseConnection();
  if (!supabaseReady) {
    log('❌ Supabase not responding. Check status with "supabase status"', RED);
    process.exit(1);
  }
  log('✅ Supabase is ready', GREEN);
  
  // Start Next.js
  const port = process.env.PORT || 4777;

  // Kill anything already on the port
  try {
    const pid = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (pid) {
      log(`⚠️  Port ${port} in use (PID ${pid}), killing...`, YELLOW);
      execSync(`kill -9 ${pid}`);
    }
  } catch {}

  log(`\n🌐 Starting Next.js on port ${port}...`, CYAN);
  log(`   Opening browser at http://localhost:${port}\n`, CYAN);

  const nextProcess = spawn('next', ['dev', '--port', port], {
    stdio: 'inherit',
    shell: true
  });
  
  // Open browser after a short delay
  setTimeout(() => {
    openBrowser(`http://localhost:${port}`);
  }, 3000);
  
  // Handle cleanup
  process.on('SIGINT', () => {
    log('\n\n👋 Shutting down...', YELLOW);
    nextProcess.kill('SIGINT');
    process.exit(0);
  });
  
  nextProcess.on('close', (code) => {
    process.exit(code || 0);
  });
}

main().catch(console.error);
