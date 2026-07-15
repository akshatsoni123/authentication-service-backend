/**
 * Container entrypoint (Issue #16):
 * 1) Wait until DATABASE_URL is reachable
 * 2) Run migrations + seeds
 * 3) exec the CMD (node server / nodemon)
 *
 * Env vars come from Compose / orchestrator (dotenv still loads .env if present).
 */
const { spawn } = require('child_process');
const { Client } = require('pg');

const MAX_ATTEMPTS = 40;
const DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[entrypoint] DATABASE_URL is required');
    process.exit(1);
  }

  console.log('[entrypoint] waiting for postgres...');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log(`[entrypoint] postgres ready (attempt ${attempt})`);
      return;
    } catch (err) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      console.log(
        `[entrypoint] postgres not ready (${attempt}/${MAX_ATTEMPTS}): ${err.message}`,
      );
      await sleep(DELAY_MS);
    }
  }

  console.error('[entrypoint] postgres did not become ready in time');
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function execCmd(argv) {
  if (!argv.length) {
    console.error('[entrypoint] no CMD provided');
    process.exit(1);
  }

  const [command, ...args] = argv;
  console.log(`[entrypoint] starting: ${command} ${args.join(' ')}`);

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  child.on('error', (err) => {
    console.error('[entrypoint] failed to start process', err);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  // Forward stop signals so Node/nodemon shut down cleanly
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }
}

async function main() {
  await waitForPostgres();

  console.log('[entrypoint] running migrations + seeds...');
  await run('npm', ['run', 'db:setup']);

  const argv = process.argv.slice(2);
  execCmd(argv);
}

main().catch((err) => {
  console.error('[entrypoint] fatal', err);
  process.exit(1);
});
