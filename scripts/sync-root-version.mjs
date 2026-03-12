/**
 * Syncs root package.json and README badge version from backend package.json.
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

const readme = readFileSync('README.md', 'utf8');
const updated = readme.replace(
  /Version-[\d.]+(-[\w.]+)?-blue/,
  `Version-${backend.version}-blue`,
);

if (readme !== updated) {
  writeFileSync('README.md', updated);
  stdout.write(`README badge synced to ${backend.version}\n`);
}
