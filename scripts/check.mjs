import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
for (const resource of [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap(script => script.js),
  ...manifest.web_accessible_resources.flatMap(entry => entry.resources),
]) {
  assert.ok(existsSync(join(root, 'extension', resource)), `Missing extension resource: ${resource}`);
}

const files = ['', 'dist', 'extension', 'scripts'].flatMap(directory =>
  readdirSync(join(root, directory), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(mjs|js)$/.test(entry.name))
    .map(entry => join(directory, entry.name))
);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.error?.message || `Syntax check failed: ${file}\n`);
    process.exit(1);
  }
}
console.log(`Manifest resources and syntax: ${files.length} JavaScript files passed.`);

const suites = ['test-engine.mjs', ...readdirSync(join(root, 'extension'))
  .filter(name => /^test(?:-.*)?\.mjs$/.test(name))
  .sort()
  .map(name => `extension/${name}`)];
for (const suite of suites) {
  console.log(`\nRunning ${suite}`);
  const result = spawnSync(process.execPath, [suite], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    process.exit(result.status || 1);
  }
}
console.log(`\nAll ${suites.length} regression suites passed. Live social-platform testing is separate.`);
