# Bing SERP Scraper

Web app that scrapes Bing page 1 organic results (blue links) for keywords — on demand or on a daily/weekly/monthly schedule. Download results as formatted Excel with rank tracking over time.

## Features

- **One-off scrapes**: Paste or upload up to 1,000 keywords, get results immediately
- **Scheduled scrapes**: Set up daily, weekly, or monthly recurring scrapes with timezone support
- **Run history**: Every scheduled run is stored with full results, viewable in-app
- **Excel export**: Download any run or full history with a Rank Tracking pivot sheet
- **Live progress**: SSE streaming shows real-time scrape progress
- **Resilient**: Auto-retry on rate limits, rotating user agents, configurable delays

## Architecture

```
client/          React + Vite frontend (static build served by Express)
server/          Express.js backend
  index.js       API + scraping engine + node-cron scheduler
  data/          Persistent JSON storage (schedules.json, history.json)
```

## Deploy to Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect the GitHub repo — Railway auto-detects `nixpacks.toml`
4. **Important**: Attach a Railway Volume mounted at `/app/server/data` to persist schedules across deploys
5. Share the URL with your team

## Local Development

```bash
# Install
cd server && npm install && cd ../client && npm install

# Terminal 1 — backend (port 3001)
cd server && node index.js

# Terminal 2 — frontend with hot reload (port 5173, proxies API)
cd client && npm run dev
```

## API

### One-off Scrapes
| Endpoint | Method | Description |
|---|---|---|
| `/api/scrape` | POST | Start scrape. Body: `{ keywords: string[], delayMin?, delayMax? }` |
| `/api/scrape/:id/stream` | GET | SSE progress stream |
| `/api/scrape/:id` | GET | Job status + results |
| `/api/scrape/:id/download` | GET | Download `.xlsx` |
| `/api/scrape/:id/cancel` | POST | Cancel running job |

### Schedules
| Endpoint | Method | Description |
|---|---|---|
| `/api/schedules` | GET | List all schedules |
| `/api/schedules` | POST | Create schedule. Body: `{ name?, keywords, frequency, timeOfDay?, timezone? }` |
| `/api/schedules/:id` | PUT | Update schedule |
| `/api/schedules/:id` | DELETE | Delete schedule |
| `/api/schedules/:id/run` | POST | Trigger immediate run |
| `/api/schedules/:id/history` | GET | List all runs for schedule |
| `/api/schedules/:id/download` | GET | Download all history as `.xlsx` |
| `/api/health` | GET | Health check |
