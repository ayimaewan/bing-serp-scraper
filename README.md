# Bing SERP Scraper

A web app that scrapes Bing page 1 organic results for a list of keywords and exports to Excel.

## Features

- Paste or upload up to 1,000 keywords
- Live progress streaming via SSE
- Configurable request delays
- Automatic retries with backoff on rate limiting
- Download results as formatted `.xlsx`
- Preview results in-app before downloading

## Architecture

- **Frontend**: React + Vite (served as static files in production)
- **Backend**: Express.js with Cheerio for HTML parsing
- **Export**: ExcelJS for `.xlsx` generation

## Deploy to Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect the GitHub repo
4. Railway auto-detects the `nixpacks.toml` config and deploys
5. Share the URL with your team

## Local Development

```bash
# Install dependencies
cd server && npm install && cd ../client && npm install

# Terminal 1 — backend
cd server && node index.js

# Terminal 2 — frontend (with API proxy)
cd client && npm run dev
```

Server runs on `:3001`, Vite dev server on `:5173` with proxy to the backend.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/scrape` | POST | Start a scrape job. Body: `{ keywords: string[], delayMin?: number, delayMax?: number }` |
| `/api/scrape/:id/stream` | GET | SSE progress stream |
| `/api/scrape/:id` | GET | Job status + results |
| `/api/scrape/:id/download` | GET | Download `.xlsx` |
| `/api/scrape/:id/cancel` | POST | Cancel a running job |
| `/api/health` | GET | Health check |
