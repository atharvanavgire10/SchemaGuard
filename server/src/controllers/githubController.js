'use strict';
const { getPullRequest, postPRComment, formatPRComment } = require('../services/githubService');
const { analyze } = require('../services/compatibilityService');

/**
 * Analyze a GitHub PR and optionally post a comment.
 * Requires GITHUB_TOKEN in environment.
 */
const analyzePR = async (req, res) => {
  try {
    const { owner, repo, prNumber, before, after, postComment = false } = req.body;

    if (!owner || !repo || !prNumber || !before || !after) {
      return res.status(400).json({
        error: 'owner, repo, prNumber, before, and after are required'
      });
    }

    const token = process.env.GITHUB_TOKEN;
    if (postComment && !token) {
      return res.status(503).json({
        error: 'GITHUB_TOKEN not configured. Cannot post PR comment.',
        hint: 'Set GITHUB_TOKEN environment variable to enable GitHub integration.'
      });
    }

    // Run compatibility analysis
    const result = analyze(before, after);

    let comment = null;
    let prData = null;

    if (token) {
      try {
        prData = await getPullRequest(owner, repo, prNumber, token);
      } catch (err) {
        console.warn('Could not fetch PR data:', err.message);
      }

      if (postComment) {
        const commentBody = formatPRComment(result, {
          endpoint: `${repo} API`,
          owner, repo, prNumber
        });
        try {
          comment = await postPRComment(owner, repo, prNumber, commentBody, token);
        } catch (err) {
          console.warn('Could not post PR comment:', err.message);
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
    console.error('GitHub analyze error:', err.message);
    return res.status(500).json({ error: 'GitHub integration failed' });
  }
};

/**
 * Get GitHub integration status.
 */
const getStatus = (req, res) => {
  const hasToken = !!process.env.GITHUB_TOKEN;
  return res.json({
    configured: hasToken,
    message: hasToken
      ? 'GitHub integration is configured. Token present.'
      : 'GitHub integration not configured. Set GITHUB_TOKEN to enable PR comments.',
    docs: 'https://github.com/atharvanavgire10/SchemaGuard#github-integration'
  });
};

module.exports = { analyzePR, getStatus };
