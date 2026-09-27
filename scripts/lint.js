'use strict';
/**
 * Minimal zero-dependency "lint" step: recursively syntax-checks every
 * .js file in the project (excluding node_modules) using Node's own
 * `--check` flag. This is intentionally lightweight so CI has no
 * network dependency on ESLint or similar - swap in a real linter
 * later (see README) once the team has settled on style rules.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'data']);

function collectJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = collectJsFiles(ROOT);
let failed = false;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`OK    ${path.relative(ROOT, file)}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL  ${path.relative(ROOT, file)}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  }
}

if (failed) {
  console.error(`\nLint failed: ${files.length} file(s) checked.`);
  process.exit(1);
} else {
  console.log(`\nLint passed: ${files.length} file(s) checked.`);
}
