# Zone-Draft

Autonomous multi-agent NYC real estate underwriting and zoning intelligence platform.

## Architecture

- **apps/web** — Next.js 15 tri-panel UI (Hazey-inspired landing + underwriting terminal)
- **apps/agents-ts** — Mastra TypeScript agents (Intake Parser, Financial Underwriter)
- **services/geo-agent** — Python FastAPI (Zoning Compliance, Spatial Calculator)
- **shared/types** — Band room schema + domain types

Four agents communicate exclusively through Band rooms.

## Quick Start

### 1. Environment

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/geo-agent/.env.example services/geo-agent/.env
```

Fill in API keys in `.env.local` and `.env`.

### 2. Web App

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, then **Launch Terminal** or visit `/underwrite`.

### 3. Python Geo Agent (optional)

```bash
cd services/geo-agent
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python scripts/ingest_zoning_docs.py
uvicorn main:app --reload --port 8000
```

### 4. Supabase

Run `supabase/schema.sql` in your Supabase SQL Editor.

## Demo Address

```
45-18 Court Square, Long Island City, Queens, NY 11101
```

Or enter BBL directly: `4001420045`

Geocoder results may differ slightly from static README examples — always confirm BBL on the preview step before running analysis. Expected zone for Court Square: M1-5/R7X with UAP FAR ~4.6.

## Optional: Python Geo Agent

For richer zoning/spatial logic (RAG over ZR sections), run the geo-agent at `localhost:8000`. The web app falls back to built-in TypeScript rules when the service is unavailable.

## Design

UI inspired by [Studio Hazey](https://www.studiohazey.com/) with a warm brown palette (#2C1810 → #EDE4D9 → #C8956C).

## Export

When underwriting completes, download a `.zip` containing:
- `blueprint_report.md`
- `financial_underwriting.csv`
- `site_geometry.json`
