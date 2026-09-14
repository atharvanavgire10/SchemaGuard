'use strict';
const { getPullRequest, postPRComment, formatPRComment, isValidGitHubName } = require('../services/githubService');
const { analyze } = require('../services/compatibilityService');

/**
 * Analyze a GitHub PR and optionally post a comment.
 * Requires GITHUB_TOKEN in environment for write actions.
 */
const analyzePR = async (req, res) => {
  try {
    const { owner, repo, prNumber, before, after, postComment = false, endpoint } = req.body;

    if (!owner || !repo || !prNumber || !before || !after) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'owner, repo, prNumber, before, and after schemas are required'
        }
      });
    }

    if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REPOSITORY',
          message: 'Repository owner and name must contain only alphanumeric characters, dashes, dots, or underscores'
        }
      });
    }

    const prNum = parseInt(prNumber, 10);
    if (isNaN(prNum) || prNum <= 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PR_NUMBER',
          message: 'prNumber must be a positive integer'
        }
      });
    }

    const token = process.env.GITHUB_TOKEN;
    if (postComment && !token) {
      return res.status(503).json({
        error: {
          code: 'GITHUB_TOKEN_MISSING',
          message: 'GITHUB_TOKEN is not configured in the server environment. Cannot post PR comment.'
        },
        hint: 'Set GITHUB_TOKEN in server/.env to enable automated GitHub PR comments.'
      });
    }

    // Run deterministic compatibility analysis
    const result = analyze(before, after);

    let comment = null;
    let prData = null;

    if (token) {
      try {
        prData = await getPullRequest(owner, repo, prNum, token);
      } catch (err) {
        console.warn('Could not fetch PR data from GitHub API:', err.message);
      }

      if (postComment) {
        const commentBody = formatPRComment(result, {
          endpoint: endpoint || `${owner}/${repo} API`,
          owner,
          repo,
          prNumber: prNum
        });
        try {
          comment = await postPRComment(owner, repo, prNum, commentBody, token);
        } catch (err) {
          console.warn('Could not post comment on GitHub PR:', err.message);
          return res.status(502).json({
            ...result,
            pr: prData ? { title: prData.title, number: prData.number, url: prData.html_url } : null,
            commentError: 'GitHub rejected the PR comment request'
          });
        }
      }
    }

    return res.json({
      ...result,
      pr: prData ? {
        title: prData.title,
        number: prData.number,
        url: prData.html_url
      } : null,
      comment: comment ? { id: comment.id, url: comment.html_url } : null
    });
  } catch (err) {
    console.error('GitHub PR analysis error:', err.message);
    return res.status(500).json({
      error: {
        code: 'GITHUB_ANALYSIS_FAILED',
        message: 'GitHub integration process encountered an unexpected failure'
      }
    });
  }
};

/**
 * Get GitHub integration status.
 */
const getStatus = (req, res) => {
  const hasToken = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0);
  return res.json({
    configured: hasToken,
    message: hasToken
      ? 'GitHub integration is active and token is configured.'
      : 'GitHub integration running in read-only mode. Set GITHUB_TOKEN in server/.env to enable PR comments.',
    docs: 'https://github.com/atharvanavgire10/SchemaGuard#github-integration'
  });
};

module.exports = { analyzePR, getStatus };
