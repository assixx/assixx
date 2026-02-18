/**
 * Syncs root package.json version from backend package.json.
 * Called automatically after `changeset version` to keep all versions in lockstep.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { stdout } from 'node:process';

const backend = JSON.parse(readFileSync('backend/package.json', 'utf8'));
const root = JSON.parse(readFileSync('package.json', 'utf8'));

if (root.version !== backend.version) {
  root.version = backend.version;
  writeFileSync('package.json', JSON.stringify(root, null, 2) + '\n');
  stdout.write(`Root version synced to ${backend.version}\n`);
}
