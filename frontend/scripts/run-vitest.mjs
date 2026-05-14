import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--runInBand');
const vitestBin = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

const child = spawn(process.execPath, [vitestBin, ...forwardedArgs], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
