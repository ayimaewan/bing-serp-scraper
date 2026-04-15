import { useState, useRef, useEffect, useCallback } from "react";

const API = "";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0e17; --surface: #111827; --surface-2: #1a2235; --surface-3: #0d1220;
    --border: #1e2a3d; --border-hi: #2d3f59;
    --text: #e2e8f0; --text-dim: #7a8ba7; --text-muted: #4a5a73;
    --accent: #00d4aa; --accent-glow: rgba(0,212,170,0.15); --accent-2: #0ea5e9;
    --red: #f87171; --orange: #fb923c; --green: #34d399; --yellow: #fbbf24;
    --mono: 'JetBrains Mono', monospace; --sans: 'DM Sans', sans-serif;
  }
  body { font-family: var(--sans); background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .app { max-width: 960px; margin: 0 auto; padding: 48px 24px 80px; }

  .header { margin-bottom: 40px; }
  .header-badge { display: inline-block; font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); background: var(--accent-glow); border: 1px solid rgba(0,212,170,0.2); border-radius: 4px; padding: 4px 10px; margin-bottom: 16px; }
  .header h1 { font-family: var(--mono); font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin-bottom: 8px; }
  .header p { color: var(--text-dim); font-size: 15px; line-height: 1.5; }

  /* Tabs */
  .tabs { display: flex; gap: 2px; background: var(--surface-3); border-radius: 10px; padding: 3px; margin-bottom: 28px; border: 1px solid var(--border); }
  .tab { flex: 1; font-family: var(--mono); font-size: 13px; font-weight: 600; padding: 10px 16px; border: none; background: transparent; color: var(--text-dim); cursor: pointer; border-radius: 8px; transition: all 0.15s; text-align: center; }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--surface); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }

  /* Card */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; margin-bottom: 24px; }
  .card-title { font-family: var(--mono); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 16px; }

  /* Inputs */
  .kw-input { width: 100%; min-height: 180px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: var(--mono); font-size: 13px; line-height: 1.7; color: var(--text); resize: vertical; transition: border-color 0.2s; }
  .kw-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  .kw-input::placeholder { color: var(--text-dim); opacity: 0.5; }

  .text-input { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-family: var(--mono); font-size: 13px; color: var(--text); transition: border-color 0.2s; width: 100%; }
  .text-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }

  select.text-input { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%237a8ba7'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

  .form-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .form-group { flex: 1; min-width: 150px; }
  .form-label { display: block; font-family: var(--mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); margin-bottom: 6px; }

  .controls { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; flex-wrap: wrap; gap: 12px; }
  .kw-count { font-family: var(--mono); font-size: 13px; color: var(--text-dim); }
  .kw-count strong { color: var(--accent); }

  /* Buttons */
  .btn { font-family: var(--mono); font-size: 13px; font-weight: 600; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 8px; }
  .btn-primary { background: var(--accent); color: var(--bg); }
  .btn-primary:hover:not(:disabled) { background: #00eabb; box-shadow: 0 0 20px var(--accent-glow); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-danger { background: transparent; color: var(--red); border: 1px solid rgba(248,113,113,0.3); }
  .btn-danger:hover { background: rgba(248,113,113,0.1); }
  .btn-download { background: var(--accent-2); color: #fff; }
  .btn-download:hover { background: #38bdf8; }
  .btn-ghost { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--border-hi); color: var(--text); }
  .btn-sm { padding: 6px 12px; font-size: 11px; }
  .btn-success { background: var(--green); color: var(--bg); }
  .btn-success:hover { background: #4ade80; }
  .btn-warn { background: var(--orange); color: var(--bg); }
  .btn-warn:hover { background: #fdba74; }

  /* File drop */
  .file-drop { border: 2px dashed var(--border); border-radius: 8px; padding: 16px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }
  .file-drop:hover, .file-drop.dragover { border-color: var(--accent); background: var(--accent-glow); }
  .file-drop-text { font-family: var(--mono); font-size: 13px; color: var(--text-dim); }

  /* Settings row */
  .settings-row { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
  .setting-group { display: flex; align-items: center; gap: 8px; }
  .setting-group label { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  .setting-group input { width: 60px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-family: var(--mono); font-size: 12px; color: var(--text); text-align: center; }
  .setting-group input:focus { outline: none; border-color: var(--accent); }

  /* Progress */
  .progress-bar-track { width: 100%; height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; margin-bottom: 12px; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: 3px; transition: width 0.3s ease; }
  .progress-stats { display: flex; gap: 24px; flex-wrap: wrap; }
  .stat { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  .stat strong { color: var(--text); font-size: 18px; display: block; margin-bottom: 2px; }
  .stat.fail strong { color: var(--red); }
  .stat.results strong { color: var(--accent); }

  /* Table */
  .results-table-wrap { overflow-x: auto; }
  .results-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .results-table th { font-family: var(--mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  .results-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .results-table tr:hover td { background: var(--surface-2); }
  .results-table .pos { font-family: var(--mono); font-weight: 700; color: var(--accent); text-align: center; width: 40px; }
  .results-table .kw-cell { font-weight: 500; color: var(--accent-2); }
  .results-table .url-cell { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  .results-table .url-cell a { color: var(--text-dim); text-decoration: none; }
  .results-table .url-cell a:hover { color: var(--accent); }

  /* Done banner */
  .done-banner { display: flex; align-items: center; justify-content: space-between; background: rgba(0,212,170,0.06); border: 1px solid rgba(0,212,170,0.2); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .done-banner .done-text { font-family: var(--mono); font-size: 14px; font-weight: 600; color: var(--accent); }
  .done-banner .done-sub { font-size: 13px; color: var(--text-dim); margin-top: 2px; }

  /* Schedule cards */
  .sched-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 12px; transition: border-color 0.2s; }
  .sched-card:hover { border-color: var(--border-hi); }
  .sched-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 12px; flex-wrap: wrap; }
  .sched-name { font-family: var(--mono); font-size: 15px; font-weight: 700; color: var(--text); }
  .sched-meta { font-family: var(--mono); font-size: 12px; color: var(--text-dim); line-height: 1.8; }
  .sched-meta strong { color: var(--text-muted); }
  .sched-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .badge { display: inline-block; font-family: var(--mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; }
  .badge-active { background: rgba(0,212,170,0.15); color: var(--accent); border: 1px solid rgba(0,212,170,0.25); }
  .badge-paused { background: rgba(251,191,36,0.12); color: var(--yellow); border: 1px solid rgba(251,191,36,0.25); }
  .badge-freq { background: rgba(14,165,233,0.12); color: var(--accent-2); border: 1px solid rgba(14,165,233,0.2); }

  /* History */
  .run-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); transition: background 0.1s; flex-wrap: wrap; gap: 8px; }
  .run-row:hover { background: var(--surface-2); }
  .run-date { font-family: var(--mono); font-size: 13px; color: var(--text); }
  .run-stats { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }

  .empty-state { text-align: center; padding: 48px 24px; color: var(--text-dim); }
  .empty-state .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
  .empty-state p { font-size: 14px; }

  @media (max-width: 640px) {
    .app { padding: 24px 16px 60px; }
    .header h1 { font-size: 22px; }
    .card { padding: 20px; }
    .form-row { flex-direction: column; }
  }
`;

// ---------------------------------------------------------------------------
// One-off Scrape Tab
// ---------------------------------------------------------------------------
function ScrapeTab() {
  const [keywords, setKeywords] = useState("");
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);
  const [method, setMethod] = useState("auto");
  const [engines, setEngines] = useState({});
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [phase, setPhase] = useState("input");
  const esRef = useRef(null);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Load available engines on mount
  useEffect(() => {
    fetch(`${API}/api/config`).then((r) => r.json()).then((cfg) => {
      setEngines(cfg.engines || {});
      setMethod(cfg.defaultMethod || "auto");
    }).catch(() => {});
  }, []);

  const kwList = keywords.split("\n").map((s) => s.trim()).filter(Boolean);

  const startStream = useCallback((id) => {
    esRef.current?.close();
    const es = new EventSource(`${API}/api/scrape/${id}/stream`);
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
      if (data.status === "done" || data.status === "cancelled") {
        es.close();
        setPhase("done");
        fetch(`${API}/api/scrape/${id}?full=true`).then((r) => r.json()).then((d) => setResults(d.results || []));
      }
    };
    es.onerror = () => es.close();
  }, []);

  const startScrape = async () => {
    if (!kwList.length) return;
    setPhase("running"); setProgress(null); setResults([]);
    const resp = await fetch(`${API}/api/scrape`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords: kwList, delayMin, delayMax, method }) });
    const data = await resp.json();
    setJobId(data.jobId);
    startStream(data.jobId);
  };

  const cancelScrape = async () => {
    if (jobId) await fetch(`${API}/api/scrape/${jobId}/cancel`, { method: "POST" });
    esRef.current?.close();
    setPhase("done");
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines[0]?.includes(",")) {
        const hdr = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const idx = Math.max(0, hdr.findIndex((h) => ["keyword", "keywords", "query", "search_term", "search term"].includes(h)));
        setKeywords(lines.slice(1).map((l) => (l.split(",")[idx] || "").replace(/"/g, "").trim()).filter(Boolean).join("\n"));
      } else setKeywords(lines.join("\n"));
    };
    reader.readAsText(file);
  };

  useEffect(() => () => esRef.current?.close(), []);

  const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <>
      {phase === "input" && (
        <div className="card">
          <div className="card-title">Keywords</div>
          <div className={`file-drop ${dragOver ? "dragover" : ""}`} onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}>
            <div className="file-drop-text">Drop a .txt or .csv here, or click to upload</div>
            <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          <textarea className="kw-input" placeholder={"One keyword per line...\n\nbest seo tools\ntechnical seo audit"} value={keywords} onChange={(e) => setKeywords(e.target.value)} spellCheck={false} />
          <div className="settings-row">
            <div className="setting-group"><label>Min delay (s)</label><input type="number" min={1} max={30} value={delayMin} onChange={(e) => setDelayMin(+e.target.value)} /></div>
            <div className="setting-group"><label>Max delay (s)</label><input type="number" min={1} max={60} value={delayMax} onChange={(e) => setDelayMax(+e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="form-label">Search Engine Method</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "auto", label: "Auto (best available)" },
                ...(engines.bing_api?.available ? [{ key: "bing_api", label: "Bing API" }] : []),
                ...(engines.scraper_api?.available ? [{ key: "scraper_api", label: "ScraperAPI Proxy" }] : []),
                { key: "direct", label: "Direct Scrape" },
              ].map((eng) => (
                <button key={eng.key} className={`btn btn-sm ${method === eng.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setMethod(eng.key)} style={{ fontSize: 11 }}>
                  {eng.label}
                  {eng.key === "bing_api" && !engines.bing_api?.available && <span style={{ opacity: 0.5 }}> (no key)</span>}
                </button>
              ))}
            </div>
            {method === "bing_api" && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Official Bing API — reliable structured results. 1,000 free calls/month.</div>}
            {method === "scraper_api" && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Proxied via residential IPs — best for bulk scraping. 5,000 free credits/month.</div>}
            {method === "direct" && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--orange)", marginTop: 6 }}>Direct scraping may be blocked from datacenter IPs.</div>}
          </div>
          <div className="controls">
            <div className="kw-count"><strong>{kwList.length}</strong> keyword{kwList.length !== 1 ? "s" : ""}{kwList.length > 0 && <span> · ~{Math.ceil(kwList.length * ((delayMin + delayMax) / 2) / 60)} min est.</span>}</div>
            <button className="btn btn-primary" disabled={!kwList.length} onClick={startScrape}>▸ Start Scrape</button>
          </div>
        </div>
      )}
      {phase === "running" && progress && (
        <div className="card">
          <div className="card-title">Scraping in progress</div>
          <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
          <div className="progress-stats">
            <div className="stat"><strong>{pct}%</strong>complete</div>
            <div className="stat"><strong>{progress.completed}/{progress.total}</strong>keywords</div>
            <div className="stat results"><strong>{progress.resultCount}</strong>results</div>
            {progress.failed > 0 && <div className="stat fail"><strong>{progress.failed}</strong>failed</div>}
          </div>
          <div className="controls" style={{ marginTop: 20 }}><span /><button className="btn btn-danger" onClick={cancelScrape}>✕ Cancel</button></div>
        </div>
      )}
      {phase === "done" && (
        <>
          <div className="done-banner">
            <div>
              <div className="done-text">{progress?.status === "cancelled" ? "Scrape Cancelled" : "Scrape Complete"}</div>
              <div className="done-sub">{results.length} results from {progress?.completed || 0} keywords{progress?.failed > 0 ? ` · ${progress.failed} failed` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-download" onClick={() => window.open(`${API}/api/scrape/${jobId}/download`, "_blank")}>↓ Download .xlsx</button>
              <button className="btn btn-ghost" onClick={() => { setPhase("input"); setJobId(null); setProgress(null); setResults([]); }}>New Scrape</button>
            </div>
          </div>
          {results.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 0" }}><div className="card-title">Results Preview {results.length > 100 ? "(first 100)" : ""}</div></div>
              <div className="results-table-wrap">
                <table className="results-table"><thead><tr><th>#</th><th>Keyword</th><th>Title</th><th>URL</th></tr></thead>
                  <tbody>{results.slice(0, 100).map((r, i) => (<tr key={i}><td className="pos">{r.position}</td><td className="kw-cell">{r.keyword}</td><td>{r.title}</td><td className="url-cell"><a href={r.url} target="_blank" rel="noopener noreferrer">{r.url?.slice(0, 60)}{r.url?.length > 60 ? "…" : ""}</a></td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Schedules Tab
// ---------------------------------------------------------------------------
function SchedulesTab() {
  const [schedules, setSchedules] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null); // scheduleId for history view
  const [historyRuns, setHistoryRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [timeOfDay, setTimeOfDay] = useState("06:00");
  const [timezone, setTimezone] = useState("UTC");
  const [method, setMethod] = useState("auto");
  const [engines, setEngines] = useState({});
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const resp = await fetch(`${API}/api/schedules`);
    setSchedules(await resp.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`${API}/api/config`).then((r) => r.json()).then((cfg) => { setEngines(cfg.engines || {}); setMethod(cfg.defaultMethod || "auto"); }).catch(() => {}); }, []);

  const createSchedule = async () => {
    const kwList = keywords.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!kwList.length) return;
    await fetch(`${API}/api/schedules`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, keywords: kwList, frequency, timeOfDay, timezone, method }),
    });
    setShowCreate(false); setName(""); setKeywords(""); load();
  };

  const toggleActive = async (s) => {
    await fetch(`${API}/api/schedules/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
    load();
  };

  const deleteSchedule = async (s) => {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;
    await fetch(`${API}/api/schedules/${s.id}`, { method: "DELETE" });
    load();
  };

  const runNow = async (s) => {
    await fetch(`${API}/api/schedules/${s.id}/run`, { method: "POST" });
    alert(`Run triggered for "${s.name}". Results will appear in history shortly.`);
  };

  const viewHistory = async (scheduleId) => {
    setViewing(scheduleId);
    const resp = await fetch(`${API}/api/schedules/${scheduleId}/history`);
    setHistoryRuns(await resp.json());
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines[0]?.includes(",")) {
        const hdr = lines[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const idx = Math.max(0, hdr.findIndex((h) => ["keyword", "keywords", "query", "search_term"].includes(h)));
        setKeywords(lines.slice(1).map((l) => (l.split(",")[idx] || "").replace(/"/g, "").trim()).filter(Boolean).join("\n"));
      } else setKeywords(lines.join("\n"));
    };
    reader.readAsText(file);
  };

  // History detail view
  if (viewing) {
    const sched = schedules.find((s) => s.id === viewing);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setViewing(null)} style={{ marginBottom: 8 }}>← Back</button>
            <div className="sched-name" style={{ fontSize: 18 }}>{sched?.name || "Schedule"}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {sched?.keywords?.join(", ")} · {sched?.frequency} at {sched?.timeOfDay} {sched?.timezone}
            </div>
          </div>
          <button className="btn btn-download btn-sm" onClick={() => window.open(`${API}/api/schedules/${viewing}/download`, "_blank")}>↓ Download All History</button>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 8px" }}><div className="card-title">{historyRuns.length} Run{historyRuns.length !== 1 ? "s" : ""}</div></div>
          {historyRuns.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>No runs yet. Use "Run Now" to trigger the first one.</p></div>
          ) : (
            historyRuns.map((run) => (
              <div className="run-row" key={run.id}>
                <div className="run-date">{run.ranAt}</div>
                <div className="run-stats">{run.resultCount} results{run.failedCount > 0 ? ` · ${run.failedCount} failed` : ""}</div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  // Create form
  if (showCreate) {
    const kwList = keywords.split("\n").map((s) => s.trim()).filter(Boolean);
    return (
      <div className="card">
        <div className="card-title">New Scheduled Scrape</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Schedule Name</label>
            <input className="text-input" placeholder="e.g. Daily brand check" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select className="text-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Mondays)</option>
              <option value="monthly">Monthly (1st)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Time of Day</label>
            <input className="text-input" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select className="text-input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              <option value="UTC">UTC</option>
              <option value="America/New_York">US Eastern</option>
              <option value="America/Chicago">US Central</option>
              <option value="America/Denver">US Mountain</option>
              <option value="America/Los_Angeles">US Pacific</option>
              <option value="Europe/London">UK (London)</option>
              <option value="Europe/Berlin">EU Central</option>
              <option value="Asia/Tokyo">Japan</option>
              <option value="Australia/Sydney">Australia (Sydney)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: "1 1 100%" }}>
            <label className="form-label">Search Method</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "auto", label: "Auto (best available)" },
                ...(engines.bing_api?.available ? [{ key: "bing_api", label: "Bing API" }] : []),
                ...(engines.scraper_api?.available ? [{ key: "scraper_api", label: "ScraperAPI Proxy" }] : []),
                { key: "direct", label: "Direct Scrape" },
              ].map((eng) => (
                <button key={eng.key} className={`btn btn-sm ${method === eng.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setMethod(eng.key)} type="button" style={{ fontSize: 11 }}>
                  {eng.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="form-label" style={{ marginBottom: 8 }}>Keywords</label>
        <div className="file-drop" onClick={() => fileRef.current?.click()}>
          <div className="file-drop-text">Drop a .txt or .csv here, or click to upload</div>
          <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
        </div>
        <textarea className="kw-input" style={{ minHeight: 120 }} placeholder={"One keyword per line..."} value={keywords} onChange={(e) => setKeywords(e.target.value)} spellCheck={false} />

        <div className="controls">
          <div className="kw-count"><strong>{kwList.length}</strong> keyword{kwList.length !== 1 ? "s" : ""}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!kwList.length} onClick={createSchedule}>Create Schedule</button>
          </div>
        </div>
      </div>
    );
  }

  // Schedule list
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="card-title" style={{ margin: 0 }}>{schedules.length} Schedule{schedules.length !== 1 ? "s" : ""}</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Schedule</button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : schedules.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <p>No schedules yet. Create one to automatically track Bing rankings over time.</p>
          </div>
        </div>
      ) : (
        schedules.map((s) => (
          <div className="sched-card" key={s.id}>
            <div className="sched-header">
              <div>
                <div className="sched-name">{s.name}</div>
                <div className="sched-meta">
                  <span className="badge badge-freq" style={{ marginRight: 8 }}>{s.frequency}</span>
                  <span className={`badge ${s.active ? "badge-active" : "badge-paused"}`}>{s.active ? "Active" : "Paused"}</span>
                </div>
              </div>
            </div>
            <div className="sched-meta">
              <strong>Keywords:</strong> {s.keywords.join(", ")}<br />
              <strong>Time:</strong> {s.timeOfDay} {s.timezone} · <strong>Method:</strong> {s.method === "bing_api" ? "Bing API" : s.method === "scraper_api" ? "ScraperAPI" : s.method === "direct" ? "Direct" : "Auto"}<br />
              <strong>Runs:</strong> {s.runCount || 0}{s.lastRun ? ` · Last: ${s.lastRun}` : ""}
            </div>
            <div className="sched-actions">
              <button className="btn btn-success btn-sm" onClick={() => runNow(s)}>▸ Run Now</button>
              <button className="btn btn-ghost btn-sm" onClick={() => viewHistory(s.id)}>History</button>
              <button className="btn btn-ghost btn-sm" onClick={() => window.open(`${API}/api/schedules/${s.id}/download`, "_blank")}>↓ .xlsx</button>
              <button className="btn btn-warn btn-sm" onClick={() => toggleActive(s)}>{s.active ? "Pause" : "Resume"}</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteSchedule(s)}>Delete</button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [tab, setTab] = useState("scrape");

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div className="header-badge">Ayima SEO Tools</div>
          <h1>Bing SERP Scraper</h1>
          <p>Scrape Bing page 1 rankings on demand or on a schedule. Download results as Excel.</p>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "scrape" ? "active" : ""}`} onClick={() => setTab("scrape")}>One-off Scrape</button>
          <button className={`tab ${tab === "schedules" ? "active" : ""}`} onClick={() => setTab("schedules")}>Scheduled Runs</button>
        </div>

        {tab === "scrape" && <ScrapeTab />}
        {tab === "schedules" && <SchedulesTab />}
      </div>
    </>
  );
}
