'use strict';
/**
 * SchemaGuard GitHub Integration Service
 *
 * Supports:
 * 1. Analyzing PR diff against known contracts
 * 2. Posting compatibility comments on PRs
 * 3. GitHub Actions CI integration via environment variables
 *
 * Requires: GITHUB_TOKEN environment variable
 * Does NOT store GitHub credentials anywhere other than env.
 */

const https = require('https');

const BASE_URL = 'api.github.com';

function getHeaders(token) {
  return {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${token}`,
    'User-Agent': 'SchemaGuard/1.0',
    'Content-Type': 'application/json'
  };
}

function httpsRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = getHeaders(token);
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const options = {
      hostname: BASE_URL,
      port: 443,
      path,
      method,
      headers
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Get pull request details.
 */
async function getPullRequest(owner, repo, prNumber, token) {
  const res = await httpsRequest(
    'GET',
    `/repos/${owner}/${repo}/pulls/${prNumber}`,
    null,
    token
  );
  if (res.status !== 200) throw new Error(`GitHub API error: ${res.status}`);
  return res.body;
}

/**
 * Post a comment on a pull request.
 */
async function postPRComment(owner, repo, prNumber, body, token) {
  const res = await httpsRequest(
    'POST',
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    { body },
    token
  );
  if (res.status !== 201) throw new Error(`Failed to post comment: ${res.status}`);
  return res.body;
}

/**
 * Format a compatibility result into a GitHub PR comment.
 */
function formatPRComment(result, context = {}) {
  const { endpoint = 'API Endpoint', score, classification, changes = [], impact = {} } = result;
  const { owner, repo, prNumber } = context;

  if (classification === 'SAFE') {
    return [
      '## SchemaGuard ✅ No Breaking Changes Detected',
      '',
      `**Compatibility Score:** ${score}/100`,
      `**Endpoints analyzed:** ${context.endpointsAnalyzed || 1}`,
      '',
      'All API changes are backwards compatible. Safe to merge.',
      '',
      '*Powered by [SchemaGuard](https://github.com/atharvanavgire10/SchemaGuard)*'
    ].join('\n');
  }

  const breakingChanges = changes.filter(c => c.classification === 'BREAKING');
  const riskyChanges = changes.filter(c => c.classification === 'RISKY');

  const lines = [
    classification === 'BREAKING'
      ? '## SchemaGuard 🚨 Breaking Changes Detected'
      : '## SchemaGuard ⚠️ Potentially Risky Changes Detected',
    '',
    `**Endpoint:** \`${endpoint}\``,
    `**Compatibility Score:** ${score}/100`,
    `**Classification:** ${classification}`,
    ''
  ];

  if (breakingChanges.length > 0) {
    lines.push('### Breaking Changes');
    for (const c of breakingChanges) {
      lines.push(`- \`${c.path}\`: ${c.change} — ${c.reason}`);
    }
    lines.push('');
  }

  if (riskyChanges.length > 0) {
    lines.push('### Risky Changes');
    for (const c of riskyChanges) {
      lines.push(`- \`${c.path}\`: ${c.change} — ${c.reason}`);
    }
    lines.push('');
  }

  if (impact.affectedTrafficPct > 0) {
    lines.push(`**Affected Traffic:** ${impact.affectedTrafficPct}%`);
    if (impact.affectedClients?.length > 0) {
      lines.push(`**Affected Consumers:** ${impact.affectedClients.join(', ')}`);
    }
    lines.push('');
  }

  lines.push(
    classification === 'BREAKING'
      ? '> ⚠️ **Recommendation:** Review and address breaking changes before merging.'
      : '> ⚠️ **Recommendation:** Review risky changes and ensure consumers handle them.'
  );
  lines.push('');
  lines.push('*Powered by [SchemaGuard](https://github.com/atharvanavgire10/SchemaGuard)*');

  return lines.join('\n');
}

module.exports = { getPullRequest, postPRComment, formatPRComment };
