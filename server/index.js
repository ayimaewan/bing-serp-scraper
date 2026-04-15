const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const { v4: uuidv4 } = require("uuid");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve static frontend in production
const clientBuild = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
}

// ---------------------------------------------------------------------------
// In-memory job store
// ---------------------------------------------------------------------------
const jobs = new Map();

// Auto-cleanup jobs older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      if (job.excelPath && fs.existsSync(job.excelPath)) fs.unlinkSync(job.excelPath);
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// User agents & headers
// ---------------------------------------------------------------------------
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

// ---------------------------------------------------------------------------
// Bing scraper
// ---------------------------------------------------------------------------
async function fetchBing(keyword, retries = 3) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&count=10`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });
      if (resp.status === 200) return await resp.text();
      if (resp.status === 429) {
        await sleep(10000 * attempt);
        continue;
      }
      await sleep(5000);
    } catch (e) {
      if (attempt === retries) return null;
      await sleep(5000);
    }
  }
  return null;
}

function parseSERP(html) {
  const $ = cheerio.load(html);
  const results = [];
  $("li.b_algo").each((i, el) => {
    const linkTag = $(el).find("h2 a").first();
    if (!linkTag.length) return;
    const title = linkTag.text().trim();
    const href = linkTag.attr("href") || "";
    const snippetEl = $(el).find("div.b_caption p").first() || $(el).find("p").first();
    const snippet = snippetEl.length ? snippetEl.text().trim() : "";
    const citeEl = $(el).find("cite").first();
    const displayUrl = citeEl.length ? citeEl.text().trim() : "";
    results.push({ position: i + 1, title, url: href, displayUrl, snippet });
  });
  return results;
}

// ---------------------------------------------------------------------------
// Excel generator
// ---------------------------------------------------------------------------
async function generateExcel(allData) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SERP Results");

  // Header style
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B579A" } };
  const headerFont = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  ws.columns = [
    { header: "Keyword", key: "keyword", width: 30 },
    { header: "Position", key: "position", width: 10 },
    { header: "Title", key: "title", width: 45 },
    { header: "URL", key: "url", width: 55 },
    { header: "Display URL", key: "displayUrl", width: 35 },
    { header: "Snippet", key: "snippet", width: 60 },
    { header: "Scraped At", key: "scrapedAt", width: 18 },
  ];

  ws.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "G1" };

  for (const row of allData) ws.addRow(row);

  // Summary sheet
  const ws2 = wb.addWorksheet("Summary");
  ws2.getCell("A1").value = "Bing SERP Scrape Summary";
  ws2.getCell("A1").font = { name: "Arial", bold: true, size: 14 };
  ws2.getCell("A2").value = "Total Results";
  ws2.getCell("B2").value = allData.length;
  ws2.getCell("A3").value = "Unique Keywords";
  ws2.getCell("B3").value = new Set(allData.map((r) => r.keyword)).size;
  ws2.getCell("A4").value = "Scrape Date";
  ws2.getCell("B4").value = new Date().toISOString().slice(0, 16).replace("T", " ");
  ws2.getColumn(1).width = 25;
  ws2.getColumn(2).width = 20;

  const tmpPath = path.join("/tmp", `serp_${uuidv4()}.xlsx`);
  await wb.xlsx.writeFile(tmpPath);
  return tmpPath;
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Start a scrape job
app.post("/api/scrape", (req, res) => {
  const { keywords, delayMin = 2, delayMax = 5 } = req.body;
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "Provide a keywords array" });
  }
  if (keywords.length > 1000) {
    return res.status(400).json({ error: "Max 1000 keywords per job" });
  }

  const jobId = uuidv4();
  const job = {
    id: jobId,
    status: "running",
    total: keywords.length,
    completed: 0,
    failed: 0,
    results: [],
    failedKeywords: [],
    createdAt: Date.now(),
    excelPath: null,
  };
  jobs.set(jobId, job);

  // Run scrape in background
  (async () => {
    for (let i = 0; i < keywords.length; i++) {
      if (job.status === "cancelled") break;

      const kw = keywords[i].trim();
      if (!kw) { job.completed++; continue; }

      const html = await fetchBing(kw);
      if (html) {
        const parsed = parseSERP(html);
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        for (const r of parsed) {
          job.results.push({ keyword: kw, scrapedAt: now, ...r });
        }
      } else {
        job.failed++;
        job.failedKeywords.push(kw);
      }
      job.completed++;

      if (i < keywords.length - 1) {
        await sleep(randBetween(delayMin, delayMax) * 1000);
      }
    }

    // Generate Excel
    try {
      job.excelPath = await generateExcel(job.results);
    } catch (e) {
      console.error("Excel generation failed:", e);
    }
    if (job.status !== "cancelled") job.status = "done";
  })();

  res.json({ jobId });
});

// SSE progress stream
app.get("/api/scrape/:jobId/stream", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const interval = setInterval(() => {
    const payload = {
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      resultCount: job.results.length,
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (job.status === "done" || job.status === "cancelled") {
      clearInterval(interval);
      res.end();
    }
  }, 500);

  req.on("close", () => clearInterval(interval));
});

// Get job status / results
app.get("/api/scrape/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    resultCount: job.results.length,
    failedKeywords: job.failedKeywords,
    results: req.query.full === "true" ? job.results : job.results.slice(0, 50),
  });
});

// Download Excel
app.get("/api/scrape/:jobId/download", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!job.excelPath || !fs.existsSync(job.excelPath)) {
    return res.status(404).json({ error: "Excel not ready yet" });
  }
  res.download(job.excelPath, "bing_serp_results.xlsx");
});

// Cancel job
app.post("/api/scrape/:jobId/cancel", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  job.status = "cancelled";
  res.json({ status: "cancelled" });
});

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// SPA fallback
app.get("*", (req, res) => {
  const index = path.join(clientBuild, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(200).send("Bing SERP Scraper API running. Deploy the frontend for the full UI.");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
