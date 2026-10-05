const { readdirSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '..');
const mode = process.argv[2] || 'unit';
if (!['unit', 'integration'].includes(mode)) throw new Error('Use unit or integration.');
function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : discover(path);
    return /\.(?:spec|test)\.ts$/.test(entry.name) && /\.integration\.(?:spec|test)\.ts$/.test(entry.name) === (mode === 'integration') ? [relative(root, path)] : [];
  });
}
const files = discover(join(root, 'src')).sort();
if (!files.length) throw new Error(`No ${mode} tests found.`);
console.log(`Running ${files.length} ${mode} test files.`);
const result = spawnSync(process.execPath, [
  '--require', './scripts/register-email-tests.cjs', '--test',
  `--test-concurrency=${mode === 'integration' ? 1 : 2}`, ...files,
], { cwd: root, env: process.env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
