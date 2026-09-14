const fs = require('fs');
let css = fs.readFileSync('client/src/App.css', 'utf-8');
const badIndex = css.indexOf('. h e r o - t a g');
if (badIndex !== -1) {
  css = css.substring(0, badIndex).replace(/\x00/g, '');
}
const additions = `
.hero-tag { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); margin-bottom: 1rem; }
.hero-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; }
.secondary { background: transparent; border: 1px solid var(--border); color: var(--text-muted); }
.secondary:hover { background: var(--bg-hover); color: var(--text-primary); }
.header-right { display: flex; gap: 1rem; align-items: center; }
.github-link { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; }
.github-link:hover { color: var(--accent); }
.how-it-works { margin: 4rem 0; }
.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
.step { background: var(--bg-card); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); }
.step-num { font-size: 2rem; font-weight: 800; color: var(--border); margin-bottom: 0.5rem; }
.score-ring { width: 64px; height: 64px; border-radius: 50%; border: 4px solid var(--score-color); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.score-number { font-size: 1.25rem; font-weight: bold; color: var(--score-color); line-height: 1; }
.score-label { font-size: 0.65rem; color: var(--text-muted); }
.summary-pills { display: flex; gap: 0.5rem; margin-top: 1rem; }
.pill { padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; }
.pill.breaking { background: rgba(255,119,119,0.1); color: #ff7777; }
.pill.risky { background: rgba(231,184,92,0.1); color: #e7b85c; }
.pill.safe { background: rgba(112,214,155,0.1); color: #70d69b; }
.affected-clients { display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem; font-size: 0.85rem; }
.clients-label { color: var(--text-muted); }
.client-badge { padding: 0.2rem 0.5rem; background: var(--bg-hover); border-radius: 4px; color: var(--text-primary); border: 1px solid var(--border); }
.detection { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border); }
.detection-steps { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem; }
.det-step { display: flex; flex-direction: column; gap: 0.5rem; }
.det-label { font-size: 0.85rem; font-weight: bold; color: var(--text-muted); }
.schema-preview { padding: 1rem; background: #111; border-radius: 4px; border: 1px solid var(--border); color: var(--text-primary); font-family: monospace; font-size: 0.85rem; overflow-x: auto; white-space: pre-wrap; }
.changes-list { display: flex; flex-direction: column; gap: 1rem; }
.change-item { padding: 1rem; background: var(--bg-card); border-radius: 6px; border: 1px solid var(--border); }
.change-header { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.5rem; }
.change-badge { font-size: 0.75rem; font-weight: bold; }
.change-path { font-family: monospace; background: #111; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85rem; }
.change-type { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.change-reason { font-size: 0.9rem; color: var(--text-primary); margin: 0 0 0.75rem 0; line-height: 1.4; }
.change-diff { display: flex; flex-direction: column; gap: 0.25rem; font-family: monospace; font-size: 0.8rem; background: #111; padding: 0.5rem; border-radius: 4px; }
.diff-before { color: #ff7777; text-decoration: line-through; }
.diff-after { color: #70d69b; }
.no-changes { padding: 1rem; background: rgba(112,214,155,0.1); border-radius: 6px; color: #70d69b; margin-top: 1rem; border: 1px solid rgba(112,214,155,0.2); }
.error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; text-align: center; }
.error-banner { background: rgba(255,119,119,0.1); border: 1px solid #ff7777; color: #ff7777; padding: 1rem; border-radius: 6px; margin: 1.5rem 0; }
.panel-header { margin-bottom: 1.5rem; }
.panel-sub { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem; }
.github-section { margin: 4rem 0; }
.github-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; background: var(--bg-card); padding: 2rem; border-radius: 8px; border: 1px solid var(--border); }
.github-features { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.gh-feature { display: flex; gap: 1rem; align-items: flex-start; }
.gh-icon { font-size: 1.5rem; }
.gh-feature strong { display: block; margin-bottom: 0.25rem; }
.gh-feature p { margin: 0; font-size: 0.9rem; color: var(--text-muted); }
.github-example { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; justify-content: center; }
.pr-comment { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; overflow: hidden; }
.pr-comment-header { background: #161b22; padding: 0.75rem 1rem; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; }
.bot-badge { background: #1f2428; border: 1px solid #30363d; padding: 0.1rem 0.4rem; border-radius: 2em; color: #8b949e; }
.pr-time { color: #8b949e; }
.pr-comment-body { padding: 1rem; font-size: 0.9rem; line-height: 1.5; color: #c9d1d9; }
.pr-comment-body code { background: rgba(110,118,129,0.4); padding: 0.2em 0.4em; border-radius: 6px; font-family: monospace; font-size: 0.85em; }
.pr-comment-body ul { padding-left: 1.5rem; margin: 0.5rem 0; }
.developer-cta { margin-top: 2rem; text-align: center; }
.setup-steps { display: flex; flex-direction: column; gap: 0.5rem; align-items: center; margin: 1.5rem 0; }
.setup-step { background: #111; padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid var(--border); font-family: monospace; font-size: 0.85rem; color: var(--text-muted); width: 100%; max-width: 500px; text-align: left; }
.tech-section { margin: 4rem 0; text-align: center; }
.tech-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 2rem; }
.tech-item { padding: 1.5rem; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.5rem; }
.tech-item span { font-size: 0.85rem; color: var(--text-muted); }
.code-block { background: #111; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); margin-top: 1rem; display: inline-block; }
footer { border-top: 1px solid var(--border); padding: 2rem 0; margin-top: 4rem; color: var(--text-muted); font-size: 0.9rem; }
.footer-inner { display: flex; justify-content: space-between; align-items: center; max-width: 1000px; margin: 0 auto; padding: 0 1rem; }
.footer-inner a { color: var(--text-muted); text-decoration: none; }
.footer-inner a:hover { color: var(--accent); }
@media (max-width: 768px) { .github-panel { grid-template-columns: 1fr; } }
`;
fs.writeFileSync('client/src/App.css', css + additions, 'utf-8');
