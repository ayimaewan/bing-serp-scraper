const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const cron = require("node-cron");
const { v4: uuidv4 } = require("uuid");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const clientBuild = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientBuild)) app.use(express.static(clientBuild));

// ---------------------------------------------------------------------------
// Persistent storage (JSON files — survives restarts on Railway volumes)
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

function loadJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, "utf-8")); }
  catch { return fallback; }
}
function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

let schedules = loadJSON(SCHEDULES_FILE, []);
let history = loadJSON(HISTORY_FILE, []);

function persistSchedules() { saveJSON(SCHEDULES_FILE, schedules); }
function persistHistory() { saveJSON(HISTORY_FILE, history); }

// ---------------------------------------------------------------------------
// In-memory one-off job store (for manual runs + SSE)
// ---------------------------------------------------------------------------
const jobs = new Map();

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      if (job.excelPath && fs.existsSync(job.excelPath)) fs.unlinkSync(job.excelPath);
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// Scraping engine
// ---------------------------------------------------------------------------
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randBetween(min, max) { return Math.random() * (max - min) + min; }

async function fetchBing(keyword, retries = 3) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&count=10&setlang=en`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ua = randomUA();
      const resp = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        redirect: "follow",
      });
      console.log(`[Bing] "${keyword}" attempt ${attempt}: status=${resp.status}, url=${resp.url}`);
      if (resp.status === 200) {
        const html = await resp.text();
        console.log(`[Bing] "${keyword}": got ${html.length} chars, has b_algo=${html.includes('b_algo')}, has b_results=${html.includes('b_results')}`);
        return html;
      }
      if (resp.status === 429) { await sleep(10000 * attempt); continue; }
      console.log(`[Bing] "${keyword}": unexpected status ${resp.status}`);
      await sleep(5000);
    } catch (e) {
      console.error(`[Bing] "${keyword}" error:`, e.message);
      if (attempt === retries) return null;
      await sleep(5000);
    }
  }
  return null;
}

function parseSERP(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Strategy 1: Standard Bing organic results (li.b_algo)
  $("li.b_algo").each((i, el) => {
    const linkTag = $(el).find("h2 a").first();
    if (!linkTag.length) return;
    results.push({
      position: i + 1,
      title: linkTag.text().trim(),
      url: linkTag.attr("href") || "",
      displayUrl: ($(el).find("cite").first().text() || "").trim(),
      snippet: ($(el).find("div.b_caption p").first().text() || $(el).find("p").first().text() || "").trim(),
    });
  });

  // Strategy 2: Alternative Bing markup (#b_results .b_algo)
  if (results.length === 0) {
    $("#b_results .b_algo").each((i, el) => {
      const linkTag = $(el).find("a").first();
      if (!linkTag.length) return;
      results.push({
        position: i + 1,
        title: linkTag.text().trim(),
        url: linkTag.attr("href") || "",
        displayUrl: ($(el).find("cite").first().text() || "").trim(),
        snippet: ($(el).find("p").first().text() || "").trim(),
      });
    });
  }

  // Strategy 3: Generic fallback — any result-like links with h2 or h3
  if (results.length === 0) {
    $("h2 a[href^='http']").each((i, el) => {
      const href = $(el).attr("href") || "";
      // Skip Bing internal links
      if (href.includes("bing.com") || href.includes("microsoft.com") || href.includes("go.microsoft")) return;
      const parent = $(el).closest("li, div.b_algo, div[class*='result'], div[class*='algo']");
      results.push({
        position: results.length + 1,
        title: $(el).text().trim(),
        url: href,
        displayUrl: (parent.find("cite").first().text() || "").trim(),
        snippet: (parent.find("p").first().text() || "").trim(),
      });
    });
  }

  console.log(`[Parser] Found ${results.length} results via ${results.length > 0 ? 'selectors' : 'none'}`);
  return results;
}

async function scrapeKeywords(keywords, delayMin = 2, delayMax = 5, jobRef = null) {
  const allResults = [];
  const failed = [];

  for (let i = 0; i < keywords.length; i++) {
    if (jobRef && jobRef.status === "cancelled") break;
    const kw = keywords[i].trim();
    if (!kw) continue;

    const html = await fetchBing(kw);
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    if (html) {
      const parsed = parseSERP(html);
      for (const r of parsed) allResults.push({ keyword: kw, scrapedAt: now, ...r });
    } else {
      failed.push(kw);
    }

    if (jobRef) {
      jobRef.completed = i + 1;
      jobRef.failed = failed.length;
      jobRef.results = allResults;
    }

    if (i < keywords.length - 1) await sleep(randBetween(delayMin, delayMax) * 1000);
  }

  return { results: allResults, failed };
}

// ---------------------------------------------------------------------------
// Excel generators
// ---------------------------------------------------------------------------
async function generateExcel(allData) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SERP Results");
  const hFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B579A" } };
  const hFont = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  ws.columns = [
    { header: "Keyword", key: "keyword", width: 30 },
    { header: "Position", key: "position", width: 10 },
    { header: "Title", key: "title", width: 45 },
    { header: "URL", key: "url", width: 55 },
    { header: "Display URL", key: "displayUrl", width: 35 },
    { header: "Snippet", key: "snippet", width: 60 },
    { header: "Scraped At", key: "scrapedAt", width: 20 },
  ];
  ws.getRow(1).eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = { horizontal: "center", vertical: "middle" }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "G1" };
  for (const row of allData) ws.addRow(row);

  const tmpPath = path.join("/tmp", `serp_${uuidv4()}.xlsx`);
  await wb.xlsx.writeFile(tmpPath);
  return tmpPath;
}

async function generateHistoryExcel(scheduleId) {
  const schedule = schedules.find((s) => s.id === scheduleId);
  if (!schedule) return null;

  const runs = history.filter((h) => h.scheduleId === scheduleId);
  if (runs.length === 0) return null;

  const wb = new ExcelJS.Workbook();
  const hFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B579A" } };
  const hFont = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  // Sheet 1: All results across all runs
  const ws = wb.addWorksheet("All Results");
  ws.columns = [
    { header: "Run Date", key: "runDate", width: 20 },
    { header: "Keyword", key: "keyword", width: 30 },
    { header: "Position", key: "position", width: 10 },
    { header: "Title", key: "title", width: 45 },
    { header: "URL", key: "url", width: 55 },
    { header: "Display URL", key: "displayUrl", width: 35 },
    { header: "Snippet", key: "snippet", width: 60 },
  ];
  ws.getRow(1).eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = { horizontal: "center", vertical: "middle" }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "G1" };

  for (const run of runs) {
    for (const r of (run.results || [])) {
      ws.addRow({ runDate: run.ranAt, keyword: r.keyword, position: r.position, title: r.title, url: r.url, displayUrl: r.displayUrl, snippet: r.snippet });
    }
  }

  // Sheet 2: Rank tracking pivot
  const ws2 = wb.addWorksheet("Rank Tracking");
  const sortedRuns = [...runs].sort((a, b) => new Date(a.ranAt) - new Date(b.ranAt));
  const dates = sortedRuns.map((r) => r.ranAt.slice(0, 10));
  const allUrls = [...new Set(runs.flatMap((r) => (r.results || []).map((x) => x.url)))];

  ws2.columns = [
    { header: "URL", key: "url", width: 55 },
    ...dates.map((d) => ({ header: d, key: d, width: 14 })),
  ];
  ws2.getRow(1).eachCell((c) => { c.fill = hFill; c.font = hFont; c.alignment = { horizontal: "center", vertical: "middle" }; });
  ws2.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];

  for (const url of allUrls) {
    const row = { url };
    for (const run of sortedRuns) {
      const dateKey = run.ranAt.slice(0, 10);
      const match = (run.results || []).find((r) => r.url === url);
      row[dateKey] = match ? match.position : "";
    }
    ws2.addRow(row);
  }

  // Sheet 3: Summary
  const ws3 = wb.addWorksheet("Summary");
  ws3.getCell("A1").value = `Schedule: ${schedule.name}`;
  ws3.getCell("A1").font = { name: "Arial", bold: true, size: 14 };
  ws3.getCell("A2").value = "Keywords"; ws3.getCell("B2").value = schedule.keywords.join(", ");
  ws3.getCell("A3").value = "Frequency"; ws3.getCell("B3").value = schedule.frequency;
  ws3.getCell("A4").value = "Total Runs"; ws3.getCell("B4").value = runs.length;
  ws3.getCell("A5").value = "First Run"; ws3.getCell("B5").value = sortedRuns[0]?.ranAt || "N/A";
  ws3.getCell("A6").value = "Latest Run"; ws3.getCell("B6").value = sortedRuns[sortedRuns.length - 1]?.ranAt || "N/A";
  ws3.getColumn(1).width = 20;
  ws3.getColumn(2).width = 50;
  for (let r = 2; r <= 6; r++) ws3.getCell(`A${r}`).font = { name: "Arial", bold: true };

  const tmpPath = path.join("/tmp", `history_${uuidv4()}.xlsx`);
  await wb.xlsx.writeFile(tmpPath);
  return tmpPath;
}

// ---------------------------------------------------------------------------
// Cron scheduling
// ---------------------------------------------------------------------------
const cronJobs = new Map();

function frequencyToCron(freq, timeOfDay = "06:00") {
  const [hour, minute] = timeOfDay.split(":").map(Number);
  switch (freq) {
    case "daily": return `${minute} ${hour} * * *`;
    case "weekly": return `${minute} ${hour} * * 1`;
    case "monthly": return `${minute} ${hour} 1 * *`;
    default: return `${minute} ${hour} * * *`;
  }
}

async function executeScheduledRun(schedule) {
  console.log(`[Scheduler] Running "${schedule.name}" (${schedule.keywords.join(", ")})`);
  const { results, failed } = await scrapeKeywords(schedule.keywords, 3, 6);

  const runRecord = {
    id: uuidv4(),
    scheduleId: schedule.id,
    ranAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    resultCount: results.length,
    failedCount: failed.length,
    results,
    failed,
  };
  history.push(runRecord);
  persistHistory();

  schedule.lastRun = runRecord.ranAt;
  schedule.totalRuns = (schedule.totalRuns || 0) + 1;
  persistSchedules();

  console.log(`[Scheduler] "${schedule.name}" done: ${results.length} results, ${failed.length} failed`);
}

function startCronJob(schedule) {
  if (cronJobs.has(schedule.id)) cronJobs.get(schedule.id).stop();
  const cronExpr = frequencyToCron(schedule.frequency, schedule.timeOfDay || "06:00");
  console.log(`[Scheduler] Registering "${schedule.name}" with cron: ${cronExpr}`);
  const task = cron.schedule(cronExpr, () => executeScheduledRun(schedule), { timezone: schedule.timezone || "UTC" });
  cronJobs.set(schedule.id, task);
}

function stopCronJob(scheduleId) {
  if (cronJobs.has(scheduleId)) { cronJobs.get(scheduleId).stop(); cronJobs.delete(scheduleId); }
}

// Restore on startup
for (const s of schedules) { if (s.active) startCronJob(s); }
console.log(`[Scheduler] Restored ${schedules.filter((s) => s.active).length} active schedule(s)`);

// ---------------------------------------------------------------------------
// API: One-off scrapes
// ---------------------------------------------------------------------------
app.post("/api/scrape", (req, res) => {
  const { keywords, delayMin = 2, delayMax = 5 } = req.body;
  if (!keywords?.length) return res.status(400).json({ error: "Provide a keywords array" });
  if (keywords.length > 1000) return res.status(400).json({ error: "Max 1000 keywords" });

  const jobId = uuidv4();
  const job = { id: jobId, status: "running", total: keywords.length, completed: 0, failed: 0, results: [], failedKeywords: [], createdAt: Date.now(), excelPath: null };
  jobs.set(jobId, job);

  (async () => {
    const { results, failed } = await scrapeKeywords(keywords, delayMin, delayMax, job);
    job.results = results;
    job.failedKeywords = failed;
    job.completed = keywords.length;
    job.failed = failed.length;
    try { job.excelPath = await generateExcel(results); } catch (e) { console.error("Excel error:", e); }
    if (job.status !== "cancelled") job.status = "done";
  })();

  res.json({ jobId });
});

app.get("/api/scrape/:jobId/stream", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ status: job.status, total: job.total, completed: job.completed, failed: job.failed, resultCount: job.results.length })}\n\n`);
    if (job.status === "done" || job.status === "cancelled") { clearInterval(interval); res.end(); }
  }, 500);
  req.on("close", () => clearInterval(interval));
});

app.get("/api/scrape/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ id: job.id, status: job.status, total: job.total, completed: job.completed, failed: job.failed, resultCount: job.results.length, failedKeywords: job.failedKeywords, results: req.query.full === "true" ? job.results : job.results.slice(0, 50) });
});

app.get("/api/scrape/:jobId/download", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job?.excelPath || !fs.existsSync(job.excelPath)) return res.status(404).json({ error: "Not ready" });
  res.download(job.excelPath, "bing_serp_results.xlsx");
});

app.post("/api/scrape/:jobId/cancel", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  job.status = "cancelled";
  res.json({ status: "cancelled" });
});

// ---------------------------------------------------------------------------
// API: Schedules
// ---------------------------------------------------------------------------
app.get("/api/schedules", (req, res) => {
  res.json(schedules.map((s) => ({
    ...s,
    runCount: history.filter((h) => h.scheduleId === s.id).length,
  })));
});

app.post("/api/schedules", (req, res) => {
  const { name, keywords, frequency, timeOfDay, timezone } = req.body;
  if (!keywords?.length) return res.status(400).json({ error: "Provide keywords" });
  if (!["daily", "weekly", "monthly"].includes(frequency)) return res.status(400).json({ error: "frequency must be daily, weekly, or monthly" });

  const schedule = {
    id: uuidv4(),
    name: name || (Array.isArray(keywords) ? keywords : [keywords]).slice(0, 3).join(", "),
    keywords: Array.isArray(keywords) ? keywords.map((k) => k.trim()).filter(Boolean) : [keywords.trim()],
    frequency,
    timeOfDay: timeOfDay || "06:00",
    timezone: timezone || "UTC",
    active: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    totalRuns: 0,
  };

  schedules.push(schedule);
  persistSchedules();
  startCronJob(schedule);
  res.json(schedule);
});

app.put("/api/schedules/:id", (req, res) => {
  const schedule = schedules.find((s) => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: "Not found" });

  const { name, keywords, frequency, timeOfDay, timezone, active } = req.body;
  if (name !== undefined) schedule.name = name;
  if (keywords !== undefined) schedule.keywords = Array.isArray(keywords) ? keywords : [keywords];
  if (frequency !== undefined) schedule.frequency = frequency;
  if (timeOfDay !== undefined) schedule.timeOfDay = timeOfDay;
  if (timezone !== undefined) schedule.timezone = timezone;
  if (active !== undefined) schedule.active = active;

  persistSchedules();
  if (schedule.active) startCronJob(schedule); else stopCronJob(schedule.id);
  res.json(schedule);
});

app.delete("/api/schedules/:id", (req, res) => {
  const idx = schedules.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  stopCronJob(schedules[idx].id);
  schedules.splice(idx, 1);
  persistSchedules();
  res.json({ deleted: true });
});

app.post("/api/schedules/:id/run", async (req, res) => {
  const schedule = schedules.find((s) => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: "Not found" });
  res.json({ status: "started" });
  executeScheduledRun(schedule);
});

// ---------------------------------------------------------------------------
// API: History
// ---------------------------------------------------------------------------
app.get("/api/schedules/:id/history", (req, res) => {
  const runs = history
    .filter((h) => h.scheduleId === req.params.id)
    .sort((a, b) => new Date(b.ranAt) - new Date(a.ranAt));
  res.json(runs.map(({ results, ...rest }) => ({ ...rest, resultCount: results?.length || rest.resultCount })));
});

app.get("/api/history/:runId", (req, res) => {
  const run = history.find((h) => h.id === req.params.runId);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
});

app.get("/api/schedules/:id/download", async (req, res) => {
  try {
    const xlPath = await generateHistoryExcel(req.params.id);
    if (!xlPath) return res.status(404).json({ error: "No history" });
    res.download(xlPath, "serp_history.xlsx", () => { try { fs.unlinkSync(xlPath); } catch {} });
  } catch (e) {
    res.status(500).json({ error: "Excel generation failed" });
  }
});

// ---------------------------------------------------------------------------
// Debug endpoint — test what Bing returns from this server's IP
app.get("/api/debug/bing", async (req, res) => {
  const kw = req.query.q || "test";
  const html = await fetchBing(kw, 1);
  if (!html) return res.json({ error: "Fetch failed", keyword: kw });
  const $ = cheerio.load(html);
  const parsed = parseSERP(html);
  res.json({
    keyword: kw,
    htmlLength: html.length,
    title: $("title").text(),
    hasAlgo: html.includes("b_algo"),
    hasResults: html.includes("b_results"),
    hasCaptcha: html.includes("captcha") || html.includes("CAPTCHA") || html.includes("unusual traffic"),
    parsedCount: parsed.length,
    parsed: parsed.slice(0, 3),
    htmlSnippet: html.slice(0, 2000),
  });
});

// Health + SPA fallback
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => res.json({ status: "ok", activeSchedules: schedules.filter((s) => s.active).length }));

app.get("*", (req, res) => {
  const index = path.join(clientBuild, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(200).send("Bing SERP Scraper API running.");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
