'use strict';
/**
 * SchemaGuard GitHub Integration Service
 *
 * Supports:
 * 1. Validating repository ownership & PR references
 * 2. Analyzing PR schema diffs against known contracts
 * 3. Posting compatibility review comments on PRs
 * 4. Checking GitHub connection readiness
 *
 * Security:
 * - Uses GITHUB_TOKEN strictly from environment variables
 * - Never returns token values in responses or logs
 * - Validates repo owner/name characters to prevent path injection
 */

const https = require('https');

const GITHUB_API_HOST = 'api.github.com';

/**
 * Validate GitHub owner and repo names to avoid directory/path manipulation.
 */
function isValidGitHubName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9._-]+$/.test(name);
}

function getHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `token ${token}`,
    'User-Agent': 'SchemaGuard-API-Compatibility-Platform/1.0',
    'Content-Type': 'application/json'
  };
}

function httpsRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = getHeaders(token);
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const options = {
      hostname: GITHUB_API_HOST,
      port: 443,
      path,
      method,
      headers,
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
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
  if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) {
    throw new Error('Invalid GitHub owner or repository name');
  }
  const prNum = parseInt(prNumber, 10);
  if (isNaN(prNum) || prNum <= 0) {
    throw new Error('Invalid pull request number');
  }

  const res = await httpsRequest(
    'GET',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNum}`,
    null,
    token
  );

  if (res.status !== 200) {
    throw new Error(`GitHub API returned status ${res.status}: ${res.body?.message || 'Failed to fetch PR'}`);
  }
  return res.body;
}

/**
 * Post a comment on a pull request.
 */
async function postPRComment(owner, repo, prNumber, body, token) {
  if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) {
    throw new Error('Invalid GitHub owner or repository name');
  }
  const prNum = parseInt(prNumber, 10);
  if (isNaN(prNum) || prNum <= 0) {
    throw new Error('Invalid pull request number');
  }

  const res = await httpsRequest(
    'POST',
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${prNum}/comments`,
    { body },
    token
  );

  if (res.status !== 201) {
    throw new Error(`GitHub comment posting failed with status ${res.status}: ${res.body?.message || 'Unknown error'}`);
  }
  return res.body;
}

/**
 * Format a compatibility result into a clear, actionable GitHub PR comment.
 */
function formatPRComment(result, context = {}) {
  const { endpoint = 'API Endpoint', score = 100, classification = 'SAFE', changes = [], impact = {} } = result;

  if (classification === 'SAFE') {
    return [
      '## SchemaGuard \u2705 No Breaking Changes Detected',
      '',
      `**Compatibility Score:** \`${score}/100\``,
      `**Endpoints Analyzed:** \`${context.endpointsAnalyzed || 1}\``,
      '',
      'All detected API schema changes are strictly backward compatible. Safe to merge.',
      '',
      '---',
      '*Automated API Safety Analysis by [SchemaGuard](https://github.com/atharvanavgire10/SchemaGuard)*'
    ].join('\n');
  }

  const breakingChanges = changes.filter(c => c.classification === 'BREAKING');
  const riskyChanges = changes.filter(c => c.classification === 'RISKY');

  const lines = [
    classification === 'BREAKING'
      ? '## SchemaGuard \ud83d\udea8 Breaking Changes Detected'
      : '## SchemaGuard \u26a0\ufe0f Potential Compatibility Risk Detected',
    '',
    `**Target Endpoint:** \`${endpoint}\``,
    `**Compatibility Score:** \`${score}/100\``,
    `**Classification:** \`${classification}\``,
    ''
  ];

  if (breakingChanges.length > 0) {
    lines.push('### \ud83d\udd34 Breaking Changes');
    for (const c of breakingChanges) {
      lines.push(`- **\`${c.path || '(root)'}\`** — \`${c.change}\`: ${c.reason}`);
      if (c.recommendation) {
        lines.push(`  *Fix:* ${c.recommendation}`);
      }
    }
    lines.push('');
  }

  if (riskyChanges.length > 0) {
    lines.push('### \ud83d\udfe1 Risky Changes');
    for (const c of riskyChanges) {
      lines.push(`- **\`${c.path || '(root)'}\`** — \`${c.change}\`: ${c.reason}`);
      if (c.recommendation) {
        lines.push(`  *Fix:* ${c.recommendation}`);
      }
    }
    lines.push('');
  }

  if (impact.affectedTrafficPct > 0) {
    lines.push('### \ud83d\udcca Production Traffic Impact');
    lines.push(`- **Estimated Affected Traffic:** \`${impact.affectedTrafficPct}%\``);
    if (Array.isArray(impact.affectedClients) && impact.affectedClients.length > 0) {
      lines.push(`- **Affected Client Consumers:** ${impact.affectedClients.map(c => `\`${c}\``).join(', ')}`);
    }
    lines.push('');
  }

  lines.push(
    classification === 'BREAKING'
      ? '> \u26a0\ufe0f **Action Required:** This pull request modifies an active contract in a breaking manner. Review before merging.'
      : '> \u26a0\ufe0f **Advisory:** Verify that downstream mobile and web clients tolerate these contract expansions.'
  );
  lines.push('');
  lines.push('---');
  lines.push('*Automated API Safety Analysis by [SchemaGuard](https://github.com/atharvanavgire10/SchemaGuard)*');

  return lines.join('\n');
}

module.exports = {
  getPullRequest,
  postPRComment,
  formatPRComment,
  isValidGitHubName
};
