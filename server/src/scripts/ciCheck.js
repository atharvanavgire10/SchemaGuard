'use strict';

// Compare changed JSON schema files in a pull request using the same engine as
// the API. This intentionally has no network calls or credentials.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { analyze } = require('../services/compatibilityService');

const base = process.env.SCHEMAGUARD_BASE_SHA;
const head = process.env.SCHEMAGUARD_HEAD_SHA || 'HEAD';
if (!base) throw new Error('SCHEMAGUARD_BASE_SHA is required');

const changed = execFileSync('git', ['diff', '--name-status', `${base}...${head}`, '--', '*.schema.json'], { encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean)
  .map(line => {
    const [status, file] = line.split('\t');
    return { status, file };
  });
const results = [];
for (const { status, file } of changed) {
  if (status === 'D') {
    results.push({
      file,
      classification: 'BREAKING',
      changes: [{ path: '(root)', change: 'CONTRACT_REMOVED', classification: 'BREAKING', reason: `Schema contract "${file}" was removed.` }]
    });
    continue;
  }
  const absolute = path.resolve(process.cwd(), '..', file);
  if (!fs.existsSync(absolute)) continue;
  try {
    const before = JSON.parse(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const after = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    results.push({ file, ...analyze(before, after) });
  } catch (error) {
    // New files have no baseline. Invalid JSON is a CI failure, never a silent pass.
    if (error instanceof SyntaxError) throw new Error(`${file}: invalid JSON schema`);
  }
}
const breaking = results.some(result => result.classification === 'BREAKING');
const report = { classification: breaking ? 'BREAKING' : results.some(r => r.classification === 'RISKY') ? 'RISKY' : 'SAFE', results };
fs.writeFileSync(process.env.SCHEMAGUARD_REPORT || '/tmp/schemaguard-report.json', JSON.stringify(report));
console.log(`SchemaGuard: ${report.classification} (${results.length} changed schema contract(s) analyzed)`);
if (breaking) process.exitCode = 1;
