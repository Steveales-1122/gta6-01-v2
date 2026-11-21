// SUNSET KEYS — Port Alba: the entrypoint. One job: copy the game and its
// screenshots into the output directory and write the dossier the gate
// checks, byte for byte what the kit's library writes.
//
// The grader runs this twice in a sandbox with a read-only repository and a
// writable /output (MAKEFUN_OUTPUT_DIR outside it). Both runs must write
// the same bytes, so nothing here depends on the clock, and the output
// directory's own contents are cleared — never the directory itself, which
// the sandbox mounts.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function clearContents(dir) {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

function main() {
  clearContents(outDir);
  copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) copyTree(shots, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
