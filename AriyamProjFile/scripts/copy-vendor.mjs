// Copies the Fuse.js browser build into vendor/ so search works without a CDN.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'fuse.js', 'dist', 'fuse.min.mjs');
if (!existsSync(from)) { console.error('fuse.js is not installed; run npm install'); process.exit(1); }
mkdirSync(join(root, 'vendor'), { recursive: true });
cpSync(from, join(root, 'vendor', 'fuse.min.mjs'));
