#!/usr/bin/env node
import { spawn } from 'child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const checks = [
  { name: 'Lint', cmd: 'npm', args: ['run', 'lint'], timeout: 60000 },
  { name: 'TypeCheck', cmd: 'npm', args: ['run', 'typecheck'], timeout: 60000 },
  { name: 'Unit Tests', cmd: 'npm', args: ['run', 'test'], timeout: 120000 },
  { name: 'Build', cmd: 'npm', args: ['run', 'build'], timeout: 180000 },
];

const results = [];

function runCheck(check) {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn(check.cmd, check.args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);
    
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        name: check.name,
        passed: false,
        duration: Date.now() - start,
        error: 'Timeout',
        output: stderr || stdout
      });
    }, check.timeout);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        name: check.name,
        passed: code === 0,
        duration: Date.now() - start,
        output: stderr || stdout
      });
    });
  });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSummary(results) {
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  
  console.log('\n' + '═'.repeat(50));
  console.log(`${BOLD}                    CHECKS SUMMARY${RESET}`);
  console.log('═'.repeat(50) + '\n');
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? GREEN : RED;
    const duration = DIM + formatDuration(result.duration) + RESET;
    console.log(`  ${icon} ${result.name.padEnd(14)} ${status}${result.passed ? 'PASSED' : 'FAILED'}${RESET} ${duration}`);
  }
  
  console.log('\n' + '─'.repeat(50));
  
  const summaryColor = failed.length === 0 ? GREEN : RED;
  const summaryText = failed.length === 0 
    ? `All ${passed.length} checks passed`
    : `${failed.length}/${results.length} checks failed`;
  
  console.log(`  ${BOLD}${summaryColor}${summaryText}${RESET} ${DIM}in ${formatDuration(totalDuration)}${RESET}`);
  console.log('═'.repeat(50) + '\n');
  
  // Print failed details
  if (failed.length > 0) {
    console.log(`${RED}${BOLD}Failed Details:${RESET}\n`);
    for (const result of failed) {
      console.log(`${YELLOW}── ${result.name} ──${RESET}`);
      const output = result.error || result.output;
      if (output) {
        const lines = output.split('\n').slice(-20).join('\n');
        console.log(DIM + lines + RESET);
      }
      console.log('');
    }
  }
  
  return failed.length;
}

async function main() {
  console.log(`\n${CYAN}${BOLD}🧪 Running all checks...${RESET}\n`);
  
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? GREEN : RED;
    process.stdout.write(`  ${icon} ${check.name}: ${status}${result.passed ? 'OK' : 'FAILED'}${RESET} ${DIM}${formatDuration(result.duration)}${RESET}\n`);
  }
  
  const exitCode = printSummary(results);
  process.exit(exitCode);
}

main();
