import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:5000";

const CLASSIFICATION_COLOR = {
  BREAKING: "#ff7777",
  RISKY: "#e7b85c",
  SAFE: "#70d69b"
};

const SEVERITY_LABEL = {
  BREAKING: { label: "BREAKING", color: "#ff7777" },
  RISKY: { label: "RISKY", color: "#e7b85c" },
  SAFE: { label: "SAFE", color: "#70d69b" }
};

function ScoreRing({ score }) {
  const color = score >= 90 ? "#70d69b" : score >= 60 ? "#e7b85c" : "#ff7777";
  return (
    <div className="score-ring" style={{ "--score-color": color }}>
      <span className="score-number">{score}</span>
      <span className="score-label">/ 100</span>
    </div>
  );
}

function ChangeItem({ change }) {
  const { label, color } = SEVERITY_LABEL[change.classification] || SEVERITY_LABEL.SAFE;
  return (
    <div className="change-item">
      <div className="change-header">
        <span className="change-badge" style={{ color }}>{label}</span>
        <code className="change-path">{change.path || '(root)'}</code>
        <span className="change-type">{change.change?.replace(/_/g, ' ')}</span>
      </div>
      <p className="change-reason">{change.reason}</p>
      {(change.before !== null || change.after !== null) && (
        <div className="change-diff">
          {change.before !== null && (
            <span className="diff-before">before: {JSON.stringify(change.before)}</span>
          )}
          {change.after !== null && (
            <span className="diff-after">after: {JSON.stringify(change.after)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [demo, setDemo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoError, setDemoError] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/api/demo`)
      .then((res) => setDemo(res.data))
      .catch((err) => {
        console.error(err);
        setDemoError("Could not connect to SchemaGuard API. Make sure the backend is running on port 5000.");
      });
  }, []);

  const analyze = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await axios.post(`${API}/api/demo/analyze`, { scenarioId: selected.id });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const statusClass = result?.classification?.toLowerCase() || "";

  if (demoError) {
    return (
      <div className="app">
        <header>
          <div className="logo">SchemaGuard</div>
          <div className="badge">API Compatibility Platform</div>
        </header>
        <main>
          <div className="error-state">
            <h2>⚠️ Backend Not Available</h2>
            <p>{demoError}</p>
            <div className="code-block">
              <code>cd server && npm install && npm run dev</code>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!demo) {
    return <div className="loading">Loading SchemaGuard...</div>;
  }

  return (
    <div className="app">
      <header>
        <div className="logo">SchemaGuard</div>
        <div className="header-right">
          <div className="badge">API Compatibility Platform</div>
          <a
            href="https://github.com/atharvanavgire10/SchemaGuard"
            className="github-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-tag">Production API Safety</div>
          <h1>Catch breaking API changes before your users do.</h1>
          <p>
            SchemaGuard analyzes API contracts against observed production traffic
            to determine whether a proposed change is SAFE, RISKY, or BREAKING —
            before deployment.
          </p>
          <div className="hero-actions">
            <button
              className="primary"
              onClick={() =>
                document.getElementById("demo").scrollIntoView({ behavior: "smooth" })
              }
            >
              Try Interactive Demo →
            </button>
            <button
              className="secondary"
              onClick={() =>
                document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth" })
              }
            >
              How it works
            </button>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="how-it-works">
          <div className="section-title">
            <span>ARCHITECTURE</span>
            <h2>How SchemaGuard Works</h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h4>Observe Production Traffic</h4>
              <p>SchemaGuard instruments your API and records the actual JSON schema of every response, building a real contract from live traffic — not documentation.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h4>Infer Contracts</h4>
              <p>The schema inference engine normalizes observations into a typed contract, tracking field presence, enum values, nullable fields, and nested structures.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h4>Analyze Compatibility</h4>
              <p>The deterministic compatibility engine compares the proposed new contract against the observed production contract and classifies every change.</p>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <h4>Calculate Impact</h4>
              <p>For each breaking change, SchemaGuard calculates which percentage of production traffic and which specific consumer clients are affected.</p>
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="demo">
          <div className="section-title">
            <span>LIVE DEMO</span>
            <h2>{demo.api.name}</h2>
          </div>

          <div className="stats">
            <div>
              <strong>{demo.api.endpoints}</strong>
              <span>Monitored Endpoints</span>
            </div>
            <div>
              <strong>{demo.api.productionRequests.toLocaleString()}</strong>
              <span>Observed Requests</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Consumer Clients</span>
            </div>
            <div>
              <strong>8</strong>
              <span>Scenarios Available</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Choose a change scenario</h3>
              <p className="panel-sub">Each scenario uses the real SchemaGuard compatibility engine — no hardcoded results.</p>
            </div>

            <div className="scenarios">
              {demo.scenarios.map((scenario) => {
                // Determine expected type from scenario id for styling
                const isSafe = scenario.id === 'add-avatar' || scenario.id === 'add-metadata';
                const isRisky = scenario.id === 'add-status-enum' || scenario.id === 'change-format';
                const typeClass = isSafe ? 'safe' : isRisky ? 'risky' : 'breaking';
                return (
                  <button
                    key={scenario.id}
                    className={`scenario ${typeClass} ${
                      selected?.id === scenario.id ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelected(scenario);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    <strong>{scenario.name}</strong>
                    <span>{scenario.description || scenario.endpoint}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="analyze"
              disabled={!selected || loading}
              onClick={analyze}
            >
              {loading ? "Analyzing..." : "Run Compatibility Check"}
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="error-banner">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`result ${statusClass}`}>
              {/* Result header */}
              <div className="result-header">
                <div>
                  <span className="result-label">{result.classification}</span>
                  <h2>
                    {result.classification === 'BREAKING' && 'Breaking Change Detected'}
                    {result.classification === 'RISKY' && 'Potential Compatibility Issue'}
                    {result.classification === 'SAFE' && 'No Breaking Changes'}
                  </h2>
                  <p className="endpoint">{result.scenario?.endpoint || '/users/:id'}</p>
                </div>
                <ScoreRing score={result.score} />
              </div>

              {/* Summary pills */}
              <div className="summary-pills">
                <span className="pill breaking">{result.summary?.breaking || 0} Breaking</span>
                <span className="pill risky">{result.summary?.risky || 0} Risky</span>
                <span className="pill safe">{result.summary?.safe || 0} Safe</span>
              </div>

              {/* Impact stats */}
              <div className="impact">
                <div>
                  <strong>{result.impact?.affectedTrafficPct || 0}%</strong>
                  <span>Traffic Affected</span>
                </div>
                <div>
                  <strong>Web</strong>
                  <span>42.1% of traffic</span>
                </div>
                <div>
                  <strong>Android</strong>
                  <span>34.8% of traffic</span>
                </div>
                <div>
                  <strong>iOS</strong>
                  <span>23.1% of traffic</span>
                </div>
              </div>

              {/* Affected clients */}
              {result.impact?.affectedTrafficPct > 0 && (
                <div className="affected-clients">
                  <span className="clients-label">Affected consumers:</span>
                  {['Android', 'iOS'].map(c => (
                    <span key={c} className="client-badge">{c}</span>
                  ))}
                </div>
              )}

              {/* Detection explanation */}
              {result.changes && result.changes.length > 0 && (
                <div className="detection">
                  <h4>How SchemaGuard detected this</h4>
                  <div className="detection-steps">
                    <div className="det-step">
                      <span className="det-label">1. Observed Production Contract</span>
                      <code className="schema-preview">GET /users/:id → \{id: integer, name: string, email: string, avatar: string|null, status: enum\}</code>
                    </div>
                    <div className="det-step">
                      <span className="det-label">2. Proposed Contract</span>
                      <code className="schema-preview">{result.scenario?.description}</code>
                    </div>
                    <div className="det-step">
                      <span className="det-label">3. Detected Changes ({result.changes.length})</span>
                      <div className="changes-list">
                        {result.changes.map((change, i) => (
                          <ChangeItem key={i} change={change} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result.changes?.length === 0 && (
                <div className="no-changes">
                  <span>✓ No contract changes detected. Fully backwards compatible.</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* GitHub Integration section */}
        <section id="github" className="github-section">
          <div className="section-title">
            <span>DEVELOPER MODE</span>
            <h2>GitHub Integration</h2>
          </div>
          <div className="github-panel">
            <div className="github-info">
              <h3>Automated PR Compatibility Checks</h3>
              <p>
                SchemaGuard integrates with GitHub to automatically analyze pull requests
                and post compatibility reports as PR comments.
              </p>
              <div className="github-features">
                <div className="gh-feature">
                  <span className="gh-icon">⚡</span>
                  <div>
                    <strong>GitHub Actions Workflow</strong>
                    <p>Triggers on every PR. Fails the build for breaking changes.</p>
                  </div>
                </div>
                <div className="gh-feature">
                  <span className="gh-icon">💬</span>
                  <div>
                    <strong>Automatic PR Comments</strong>
                    <p>Posts detailed compatibility reports directly on your pull request.</p>
                  </div>
                </div>
                <div className="gh-feature">
                  <span className="gh-icon">📊</span>
                  <div>
                    <strong>Impact Analysis</strong>
                    <p>Shows affected traffic percentage and specific consumer clients.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="github-example">
              <div className="pr-comment">
                <div className="pr-comment-header">
                  <span className="bot-badge">SchemaGuard Bot</span>
                  <span className="pr-time">just now</span>
                </div>
                <div className="pr-comment-body">
                  <p><strong>🚨 SchemaGuard: Breaking Changes Detected</strong></p>
                  <p>Endpoint: <code>GET /users/:id</code></p>
                  <ul>
                    <li>email removed (FIELD_REMOVED)</li>
                    <li>status: 'inactive' removed (ENUM_VALUE_REMOVED)</li>
                  </ul>
                  <p>Affected traffic: <strong>18.7%</strong></p>
                  <p>Consumers: Android, iOS</p>
                  <p>Compatibility Score: <strong>50/100</strong></p>
                  <p>⚠️ Review before merging.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="developer-cta">
            <h3>Set Up Developer Mode</h3>
            <div className="setup-steps">
              <div className="setup-step">
                <code>1. git clone https://github.com/atharvanavgire10/SchemaGuard.git</code>
              </div>
              <div className="setup-step">
                <code>2. Add GITHUB_TOKEN to server/.env</code>
              </div>
              <div className="setup-step">
                <code>3. POST /api/github/analyze-pr with your PR details</code>
              </div>
            </div>
            <a
              href="https://github.com/atharvanavgire10/SchemaGuard#github-integration"
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Documentation →
            </a>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="tech-section">
          <div className="section-title">
            <span>TECHNOLOGY</span>
            <h2>Built with</h2>
          </div>
          <div className="tech-grid">
            {[
              { name: 'React 19', role: 'Frontend' },
              { name: 'Node.js + Express', role: 'API Server' },
              { name: 'PostgreSQL', role: 'Persistence' },
              { name: 'Schema Inference Engine', role: 'Custom' },
              { name: 'Compatibility Engine', role: 'Custom' },
              { name: 'GitHub API', role: 'Integration' },
            ].map(t => (
              <div key={t.name} className="tech-item">
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <span>SchemaGuard — API Compatibility Platform</span>
          <a href="https://github.com/atharvanavgire10/SchemaGuard" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </div>
      </footer>
    </div>
  );
}

export default App;