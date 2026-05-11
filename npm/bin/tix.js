#!/usr/bin/env node
// Shim that execs the downloaded tix binary, forwarding argv + stdio.
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

const binPath = path.join(__dirname, 'tix-bin');
if (!fs.existsSync(binPath)) {
  console.error(
    `tix binary not found at ${binPath}.\n` +
      `Try reinstalling: npm install -g @winstonfassett/tix`
  );
  process.exit(1);
}

const result = spawnSync(binPath, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(`tix: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
