import { useState, useRef, useEffect, useCallback } from "react";

const API = "";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0e17;
    --surface: #111827;
    --surface-2: #1a2235;
    --border: #1e2a3d;
    --border-hi: #2d3f59;
    --text: #e2e8f0;
    --text-dim: #7a8ba7;
    --accent: #00d4aa;
    --accent-glow: rgba(0, 212, 170, 0.15);
    --accent-2: #0ea5e9;
    --red: #f87171;
    --orange: #fb923c;
    --mono: 'JetBrains Mono', monospace;
    --sans: 'DM Sans', sans-serif;
  }

  body {
    font-family: var(--sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }

  /* Header */
  .header {
    margin-bottom: 48px;
  }
  .header-badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-glow);
    border: 1px solid rgba(0, 212, 170, 0.2);
    border-radius: 4px;
    padding: 4px 10px;
    margin-bottom: 16px;
  }
  .header h1 {
    font-family: var(--mono);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .header p {
    color: var(--text-dim);
    font-size: 15px;
    line-height: 1.5;
  }

  /* Card */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
    margin-bottom: 24px;
  }
  .card-title {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    margin-bottom: 16px;
  }

  /* Textarea */
  .kw-input {
    width: 100%;
    min-height: 200px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.7;
    color: var(--text);
    resize: vertical;
    transition: border-color 0.2s;
  }
  .kw-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .kw-input::placeholder { color: var(--text-dim); opacity: 0.5; }

  /* Controls row */
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .kw-count {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-dim);
  }
  .kw-count strong {
    color: var(--accent);
  }

  /* Buttons */
  .btn {
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .btn-primary {
    background: var(--accent);
    color: var(--bg);
  }
  .btn-primary:hover:not(:disabled) {
    background: #00eabb;
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-danger {
    background: transparent;
    color: var(--red);
    border: 1px solid rgba(248, 113, 113, 0.3);
  }
  .btn-danger:hover { background: rgba(248, 113, 113, 0.1); }
  .btn-download {
    background: var(--accent-2);
    color: #fff;
  }
  .btn-download:hover { background: #38bdf8; }
  .btn-ghost {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--border-hi); color: var(--text); }

  /* Settings row */
  .settings-row {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .setting-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .setting-group label {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .setting-group input {
    width: 60px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
    text-align: center;
  }
  .setting-group input:focus {
    outline: none;
    border-color: var(--accent);
  }

  /* Progress */
  .progress-section {
    margin-top: 8px;
  }
  .progress-bar-track {
    width: 100%;
    height: 6px;
    background: var(--bg);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .progress-stats {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .stat {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .stat strong {
    color: var(--text);
    font-size: 18px;
    display: block;
    margin-bottom: 2px;
  }
  .stat.fail strong { color: var(--red); }
  .stat.results strong { color: var(--accent); }

  /* Results table */
  .results-table-wrap {
    overflow-x: auto;
    margin-top: 4px;
  }
  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .results-table th {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .results-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .results-table tr:hover td {
    background: var(--surface-2);
  }
  .results-table .pos {
    font-family: var(--mono);
    font-weight: 700;
    color: var(--accent);
    text-align: center;
    width: 40px;
  }
  .results-table .kw-cell {
    font-weight: 500;
    color: var(--accent-2);
  }
  .results-table .url-cell {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-dim);
  }
  .results-table .url-cell a {
    color: var(--text-dim);
    text-decoration: none;
  }
  .results-table .url-cell a:hover {
    color: var(--accent);
  }

  /* Done banner */
  .done-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 212, 170, 0.06);
    border: 1px solid rgba(0, 212, 170, 0.2);
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .done-banner .done-text {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }
  .done-banner .done-sub {
    font-size: 13px;
    color: var(--text-dim);
    margin-top: 2px;
  }

  /* File drop area */
  .file-drop {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 12px;
  }
  .file-drop:hover, .file-drop.dragover {
    border-color: var(--accent);
    background: var(--accent-glow);
  }
  .file-drop-text {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--text-dim);
  }

  @media (max-width: 640px) {
    .app { padding: 24px 16px 60px; }
    .header h1 { font-size: 22px; }
    .card { padding: 20px; }
    .kw-input { min-height: 150px; }
  }
`;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [keywords, setKeywords] = useState("");
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("input"); // input | running | done
  const eventSourceRef = useRef(null);
  const fileInputRef = useRef(null);

  const kwList = keywords
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // SSE listener
  const startStream = useCallback((id) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`${API}/api/scrape/${id}/stream`);
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
      if (data.status === "done" || data.status === "cancelled") {
        es.close();
        setPhase("done");
        // Fetch final results for table preview
        fetch(`${API}/api/scrape/${id}?full=true`)
          .then((r) => r.json())
          .then((d) => setResults(d.results || []));
      }
    };
    es.onerror = () => es.close();
  }, []);

  // Start scrape
  const startScrape = async () => {
    if (kwList.length === 0) return;
    setPhase("running");
    setProgress(null);
    setResults([]);
    try {
      const resp = await fetch(`${API}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kwList, delayMin, delayMax }),
      });
      const data = await resp.json();
      setJobId(data.jobId);
      startStream(data.jobId);
    } catch (err) {
      console.error(err);
      setPhase("input");
    }
  };

  // Cancel
  const cancelScrape = async () => {
    if (!jobId) return;
    await fetch(`${API}/api/scrape/${jobId}/cancel`, { method: "POST" });
    if (eventSourceRef.current) eventSourceRef.current.close();
    setPhase("done");
  };

  // Download
  const downloadExcel = () => {
    if (!jobId) return;
    window.open(`${API}/api/scrape/${jobId}/download`, "_blank");
  };

  // Reset
  const reset = () => {
    setPhase("input");
    setJobId(null);
    setProgress(null);
    setResults([]);
  };

  // File upload handler (CSV/TXT)
  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      // Try to extract keyword column from CSV, otherwise treat as newline-separated
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0 && lines[0].includes(",")) {
        // CSV — try to find keyword column
        const headerRow = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const kwIdx = headerRow.findIndex((h) =>
          ["keyword", "keywords", "query", "search_term", "search term"].includes(h)
        );
        const idx = kwIdx >= 0 ? kwIdx : 0;
        const extracted = lines.slice(1).map((l) => {
          const cols = l.split(",");
          return (cols[idx] || "").replace(/"/g, "").trim();
        }).filter(Boolean);
        setKeywords(extracted.join("\n"));
      } else {
        setKeywords(lines.join("\n"));
      }
    };
    reader.readAsText(file);
  };

  const [dragOver, setDragOver] = useState(false);

  // Cleanup on unmount
  useEffect(() => () => eventSourceRef.current?.close(), []);

  const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Header */}
        <div className="header">
          <div className="header-badge">Ayima SEO Tools</div>
          <h1>Bing SERP Scraper</h1>
          <p>
            Paste up to 1,000 keywords, hit scrape, and download an Excel file
            with page 1 organic rankings from Bing.
          </p>
        </div>

        {/* Input phase */}
        {phase === "input" && (
          <div className="card">
            <div className="card-title">Keywords</div>

            {/* File drop */}
            <div
              className={`file-drop ${dragOver ? "dragover" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <div className="file-drop-text">
                Drop a .txt or .csv file here, or click to upload
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            <textarea
              className="kw-input"
              placeholder={"Enter keywords, one per line...\n\nbest seo tools\ntechnical seo audit\nschema markup generator"}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              spellCheck={false}
            />

            <div className="settings-row">
              <div className="setting-group">
                <label>Min delay (s)</label>
                <input type="number" min={1} max={30} value={delayMin} onChange={(e) => setDelayMin(+e.target.value)} />
              </div>
              <div className="setting-group">
                <label>Max delay (s)</label>
                <input type="number" min={1} max={60} value={delayMax} onChange={(e) => setDelayMax(+e.target.value)} />
              </div>
            </div>

            <div className="controls">
              <div className="kw-count">
                <strong>{kwList.length}</strong> keyword{kwList.length !== 1 ? "s" : ""} loaded
                {kwList.length > 0 && (
                  <span> · ~{Math.ceil(kwList.length * ((delayMin + delayMax) / 2) / 60)} min est.</span>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={kwList.length === 0}
                onClick={startScrape}
              >
                ▸ Start Scrape
              </button>
            </div>
          </div>
        )}

        {/* Running phase */}
        {phase === "running" && progress && (
          <div className="card">
            <div className="card-title">Scraping in progress</div>
            <div className="progress-section">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-stats">
                <div className="stat">
                  <strong>{pct}%</strong> complete
                </div>
                <div className="stat">
                  <strong>{progress.completed}/{progress.total}</strong> keywords
                </div>
                <div className="stat results">
                  <strong>{progress.resultCount}</strong> results
                </div>
                {progress.failed > 0 && (
                  <div className="stat fail">
                    <strong>{progress.failed}</strong> failed
                  </div>
                )}
              </div>
            </div>
            <div className="controls" style={{ marginTop: 20 }}>
              <span />
              <button className="btn btn-danger" onClick={cancelScrape}>
                ✕ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Done phase */}
        {phase === "done" && (
          <>
            <div className="done-banner">
              <div>
                <div className="done-text">
                  {progress?.status === "cancelled" ? "Scrape Cancelled" : "Scrape Complete"}
                </div>
                <div className="done-sub">
                  {results.length} results from {progress?.completed || 0} keywords
                  {progress?.failed > 0 ? ` · ${progress.failed} failed` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-download" onClick={downloadExcel}>
                  ↓ Download .xlsx
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  New Scrape
                </button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "20px 24px 0" }}>
                  <div className="card-title">
                    Results Preview {results.length > 100 ? "(showing first 100)" : ""}
                  </div>
                </div>
                <div className="results-table-wrap">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Keyword</th>
                        <th>Title</th>
                        <th>URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(0, 100).map((r, i) => (
                        <tr key={i}>
                          <td className="pos">{r.position}</td>
                          <td className="kw-cell">{r.keyword}</td>
                          <td>{r.title}</td>
                          <td className="url-cell">
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              {r.url?.slice(0, 60)}{r.url?.length > 60 ? "…" : ""}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
