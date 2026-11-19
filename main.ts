// Midnight Duo entry point (Node 22, standard library only).
// Hands the entry in: copies app/ and screenshots/ beside this file into
// the output directory and writes /output/dossier.json, the summary the
// judge reads, using the vendored make.fun library.
//
// Local runs use MAKEFUN_OUTPUT_DIR instead of /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: same inputs, byte-identical outputs.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  return true;
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, 'app'), join(outDir, 'app'));
copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

// The dossier caps come from the scorer's gate: at most 4 screenshots of
// 256 KiB, app/ under 993 files and 48 MiB, and a 160 KiB text budget for
// the source outline the judge reads.
import { writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-app.ts';

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
