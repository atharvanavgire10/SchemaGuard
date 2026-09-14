import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:5000";

function App() {
  const [demo, setDemo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/api/demo`)
      .then((res) => setDemo(res.data))
      .catch((err) => console.error(err));
  }, []);

  const analyze = () => {
    if (!selected) return;

    if (selected.type === "breaking") {
      setResult({
        status: "breaking",
        title: "Breaking Change Detected",
        endpoint: "/users/:id",
        reason:
          selected.id === "remove-email"
            ? "The `email` field was removed from the response."
            : "The `id` field changed from integer to string.",
        affectedTraffic: "18.7%",
        risk: "HIGH"
      });
    } else if (selected.type === "risky") {
      setResult({
        status: "risky",
        title: "Potential Compatibility Issue",
        endpoint: "/users/:id",
        reason: "A previously observed enum value changed.",
        affectedTraffic: "7.2%",
        risk: "MEDIUM"
      });
    } else {
      setResult({
        status: "safe",
        title: "No Breaking Changes",
        endpoint: "/users/:id",
        reason: "An optional field was added.",
        affectedTraffic: "0%",
        risk: "LOW"
      });
    }
  };

  if (!demo) {
    return <div className="loading">Loading SchemaGuard...</div>;
  }

  return (
    <div className="app">
      <header>
        <div className="logo">SchemaGuard</div>
        <div className="badge">API Compatibility</div>
      </header>

      <main>
        <section className="hero">
          <h1>Catch API breaking changes before your users do.</h1>

          <p>
            Analyze API changes against production contracts and discover
            which clients could break before deployment.
          </p>

          <button
            className="primary"
            onClick={() =>
              document
                .getElementById("demo")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            Try Interactive Demo →
          </button>
        </section>

        <section id="demo" className="demo">
          <div className="section-title">
            <span>LIVE DEMO</span>
            <h2>{demo.api.name}</h2>
          </div>

          <div className="stats">
            <div>
              <strong>{demo.api.endpoints}</strong>
              <span>Endpoints</span>
            </div>

            <div>
              <strong>
                {demo.api.productionRequests.toLocaleString()}
              </strong>
              <span>Production Requests</span>
            </div>

            <div>
              <strong>3</strong>
              <span>Consumers</span>
            </div>
          </div>

          <div className="panel">
            <h3>Choose a scenario</h3>

            <div className="scenarios">
              {demo.scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`scenario ${scenario.type} ${
                    selected?.id === scenario.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelected(scenario);
                    setResult(null);
                  }}
                >
                  <strong>{scenario.name}</strong>
                  <span>{scenario.type}</span>
                </button>
              ))}
            </div>

            <button
              className="analyze"
              disabled={!selected}
              onClick={analyze}
            >
              Run Compatibility Check
            </button>
          </div>

          {result && (
            <div className={`result ${result.status}`}>
              <div className="result-header">
                <div>
                  <span className="result-label">{result.status}</span>
                  <h2>{result.title}</h2>
                </div>

                <strong>{result.risk}</strong>
              </div>

              <p className="endpoint">{result.endpoint}</p>

              <p>{result.reason}</p>

              <div className="impact">
                <div>
                  <strong>{result.affectedTraffic}</strong>
                  <span>Traffic affected</span>
                </div>

                <div>
                  <strong>Web</strong>
                  <span>Consumer</span>
                </div>

                <div>
                  <strong>Android</strong>
                  <span>Consumer</span>
                </div>

                <div>
                  <strong>iOS</strong>
                  <span>Consumer</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;