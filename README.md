# Zone-Draft

**Autonomous multi-agent NYC real estate underwriting and zoning intelligence platform.**

Zone-Draft closes the gap between ambitious NYC development sites and slow, fragmented site intelligence. Founder-led developers enter an address or BBL, and four specialized agents—coordinated exclusively through [Band](https://docs.band.ai/welcome) rooms—run the full underwriting pipeline: geocoding, zoning compliance, 3D buildable envelope modeling, and residual land value analysis. The result is an audit-ready export package built for investor conversations.

> *Outcomes first, zoning second. Every constraint is tested against whether the deal actually pencils.*

---

## Table of Contents

- [The Problem](#the-problem)
- [What Zone-Draft Does](#what-zone-draft-does)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Site](#demo-site)
- [API Overview](#api-overview)
- [Band Integration](#band-integration)
- [Data Sources](#data-sources)
- [Export Package](#export-package)
- [UI & Design](#ui--design)

---

## The Problem

NYC development underwriting is slow and siloed. Zoning rules, FAR limits, UAP bonuses, sky exposure planes, comparable sales, and residual land value live in different tools, spreadsheets, and consultant reports. A founder evaluating a single parcel can spend days stitching together MapPLUTO data, Zoning Resolution citations, envelope sketches, and back-of-envelope pro formas—often without the certainty that the deal is being understood correctly.

Zone-Draft automates that pipeline end to end, surfacing each agent's reasoning in real time and delivering investor-ready artifacts in minutes.

---

## What Zone-Draft Does

1. **Accepts a site** — NYC street address or 10-digit BBL (Borough-Block-Lot).
2. **Resolves the parcel** — Geocodes the input and pulls lot geometry, zoning district, and assessed values from NYC Open Data (MapPLUTO).
3. **Analyzes zoning** — Computes base FAR, UAP bonus FAR, sky exposure, rear yard, parking requirements, and applicable ZR sections (with City of Yes context).
4. **Models the envelope** — Builds a 3D buildable massing with floor counts, setbacks, and GFA limits; validates against UAP FAR caps with adversarial re-computation when needed.
5. **Underwrites the deal** — Pulls neighborhood sales comps (DOF), models hard/soft costs, financing, developer profit, and residual land value (RLV).
6. **Delivers a verdict** — `STRONG BUY`, `BUY`, `HOLD`, or `PASS` with rationale, plus downloadable report, CSV, and geometry JSON.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Tri-panel underwriting terminal** | Input parcel on the left, live agent stream in the center, deal verdict and metrics on the right |
| **Live agent stream** | Watch Intake → Zoning → Spatial → Financial agents activate and post reasoning via Band events |
| **3D site viewer** | Interactive lot map and morphing building envelope (React Three Fiber) |
| **Constraint debugger** | Surfaces zoning violations and how the spatial agent resolved them |
| **Scenario challenges** | Ask "what if" questions after analysis (e.g. land price, exit PSF) and get updated verdicts |
| **Executive email brief** | Send an investor-ready summary via Resend after underwriting completes |
| **Session persistence** | Restore sessions via URL (`/underwrite?session=...`); optional Supabase storage |
| **Graceful fallback** | Full pipeline runs without the Python geo-agent using built-in TypeScript zoning rules |

---

## How It Works

### Agent Pipeline

All four agents share state through a single Band room schema. The orchestrator runs them sequentially, emitting events at each step.

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐     ┌─────────────────────────┐
│  Intake Parser  │ ──▶ │  Zoning Compliance   │ ──▶ │ Spatial Calculator │ ──▶ │ Financial Underwriter   │
│  Geocode +      │     │  FAR, UAP, City of   │     │ 3D envelope,       │     │ DOF comps, costs, RLV,  │
│  MapPLUTO       │     │  Yes, ZR sections    │     │ setbacks, GFA      │     │ deal verdict            │
└─────────────────┘     └──────────────────────┘     └────────────────────┘     └─────────────────────────┘
         │                          │                          │                            │
         └──────────────────────────┴──────────────────────────┴────────────────────────────┘
                                          Band Room Context
                              (lot_data → zoning_analysis → building_envelope → financial_analysis)
```

### The Four Agents

| # | Agent | Responsibility |
|---|-------|----------------|
| 01 | **Intake Parser** | Geocode address or parse BBL; fetch MapPLUTO record; validate lot area and zoning district |
| 02 | **Zoning Compliance** | Base/UAP FAR, max height, sky exposure plane, rear yard, parking (City of Yes), applicable ZR sections; RAG over zoning docs when geo-agent is running |
| 03 | **Spatial Calculator** | Compute gross floor area, floor count, total height, setback planes, and 3D envelope vertices; re-iterate if FAR exceeds UAP cap |
| 04 | **Financial Underwriter** | Neighborhood sales comps, projected GDV, hard/soft/financing costs, developer profit, residual land value, and deal verdict |

### Deal Verdict Logic

The financial agent compares residual land value (RLV) against an estimated land ask (assessed land × multiplier):

| Verdict | Condition |
|---------|-----------|
| **STRONG BUY** | RLV > 150% of estimated land ask |
| **BUY** | RLV > 110% of estimated land ask |
| **HOLD** | RLV positive but thin margin |
| **PASS** | RLV negative — deal does not pencil |

---

## Architecture

```
zone-draft/
├── apps/
│   ├── web/                  # Next.js 16 app — landing page + underwriting terminal + API routes
│   └── agents-ts/            # Mastra TypeScript agents (Intake Parser, Financial Underwriter)
├── services/
│   └── geo-agent/            # Python FastAPI — Zoning Compliance + Spatial Calculator (optional)
├── shared/
│   └── types/                # Band room schema, domain types, site viewer GeoJSON
└── supabase/
    └── schema.sql            # Optional persistence for underwriting sessions
```

### Request Flow

1. User submits address/BBL on `/underwrite`.
2. `POST /api/preview` resolves the parcel (geocoder + MapPLUTO) for confirmation.
3. `POST /api/underwrite` creates a session, opens a Band room, and kicks off `runUnderwriting()` asynchronously.
4. Client polls `GET /api/band/[roomId]` (or session snapshot) for live agent events.
5. On completion, user downloads export via `GET /api/export/[id]` or emails brief via `POST /api/outbound/email`.

When the Python geo-agent is available at `GEO_AGENT_URL`, zoning and spatial steps delegate to it (with RAG over Zoning Resolution sections). Otherwise, the orchestrator uses built-in TypeScript zoning tables and envelope math.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| **3D / Maps** | React Three Fiber, MapLibre GL, Leaflet, Turf.js |
| **Agents** | Band rooms, Mastra (TypeScript), Python FastAPI geo-agent |
| **Data** | NYC Open Data (MapPLUTO, geocoder, DOF sales), ZR RAG (geo-agent) |
| **Persistence** | In-memory sessions + optional Supabase |
| **Email** | Resend |
| **Export** | JSZip (report `.md`, financial `.csv`, geometry `.json`) |

---

## Project Structure

```
apps/web/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── underwrite/page.tsx         # Underwriting terminal
│   └── api/
│       ├── preview/                # Parcel lookup before run
│       ├── underwrite/             # Start underwriting session
│       ├── band/[roomId]/          # Live Band event stream
│       ├── session/[id]/           # Session status + snapshot
│       ├── export/[id]/            # Download ZIP export
│       ├── scenario/               # What-if financial scenarios
│       └── outbound/email/         # Executive brief via Resend
├── components/
│   ├── underwrite/                 # UnderwriteWorkbench
│   ├── panels/                     # Left / Center / Right terminal panels
│   ├── three/                      # 3D building scene
│   └── ui/                         # BentoCard, DealVerdictHero, ChallengePanel, etc.
├── lib/
│   ├── orchestrator.ts             # Agent pipeline + Band room orchestration
│   ├── band-client.ts              # Band SDK wrapper + local fallback
│   ├── tools/                      # geocoder, pluto-api, sales-api
│   └── exporters/                  # Report, CSV, geometry generators
└── types/                          # Re-exports from shared/types

services/geo-agent/
├── main.py                         # FastAPI entry (health, sync-room, run agents)
├── agents/                         # zoning_compliance, spatial_calculator
└── scripts/ingest_zoning_docs.py   # RAG document ingestion
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm**
- **Python** 3.11+ (optional, for geo-agent)
- API keys: [Band](https://docs.band.ai/welcome), [NYC Open Data](https://data.cityofnewyork.us/), optional Supabase and Resend

### 1. Clone and configure environment

```bash
cd zone-draft
cp apps/web/.env.example apps/web/.env.local
```

Fill in the required keys in `apps/web/.env.local` (see [Environment Variables](#environment-variables)).

### 2. Run the web app

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, then click **Launch Terminal** or visit [/underwrite](http://localhost:3000/underwrite).

### 3. (Optional) Run the Python geo-agent

For richer zoning logic and RAG over Zoning Resolution sections:

```bash
cd services/geo-agent
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scripts/ingest_zoning_docs.py
uvicorn main:app --reload --port 8000
```

Set `GEO_AGENT_URL=http://localhost:8000` in `apps/web/.env.local`. The web app falls back to built-in TypeScript rules when the service is unavailable.

### 4. (Optional) Supabase persistence

Run `supabase/schema.sql` in your Supabase SQL Editor, then set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local`.

---

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `BAND_API_KEY` | Yes* | Human Band API key (`band_u_*`) for room creation and message polling |
| `BAND_API_BASE_URL` | No | Band API base URL (default: `https://app.band.ai`) |
| `BAND_AGENT_API_KEY` | No | Orchestrator agent key; auto-registered if unset |
| `BAND_AGENT_ID` | No | Orchestrator agent ID |
| `NYCOPENDATA_APP_TOKEN` | Recommended | NYC Open Data app token for MapPLUTO and geocoder rate limits |
| `GEO_AGENT_URL` | No | Python geo-agent URL (default: `http://localhost:8000`) |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_ANON_KEY` | No | Supabase anon key |
| `RESEND_API_KEY` | No | Resend API key for executive email briefs |
| `RESEND_FROM_EMAIL` | No | Sender address for outbound emails |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL for email deep links (default: `http://localhost:3000`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Google AI for optional agent enhancements |

\*The app can run in local-only mode without Band configured, using in-memory room state. Full multi-agent audit trail requires Band keys.

---

## Demo Site

Use this address for a live demo:

```
45-18 Court Square, Long Island City, Queens, NY 11101
```

Or enter the BBL directly:

```
4001420045
```

**Expected results for Court Square:** zone `M1-5/R7X`, UAP FAR ~4.6.

> Geocoder results may differ slightly from static examples. Always confirm the BBL on the preview step before running analysis.

### Demo flow

1. Open `/underwrite`
2. Enter the address or BBL
3. Confirm parcel details on the preview step
4. Click **Run Analysis** and watch the agent stream
5. Review the deal verdict, 3D envelope, and constraint log
6. Download the ZIP export or send an executive email brief

---

## API Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/preview` | POST | Resolve address/BBL to MapPLUTO parcel preview |
| `/api/underwrite` | POST | Create session, open Band room, start agent pipeline |
| `/api/band/[roomId]` | GET | Poll live Band events for the underwriting room |
| `/api/session/[id]` | GET | Session status |
| `/api/session/[id]/snapshot` | GET | Full room schema snapshot (for session restore) |
| `/api/export/[id]` | GET | Download ZIP (report + CSV + geometry) |
| `/api/scenario` | POST | Run what-if financial scenarios on completed sessions |
| `/api/outbound/email` | POST | Send executive brief to investors via Resend |
| `/api/memo/[id]` | GET | Markdown underwriting memo |
| `/api/site-viewer/[sessionId]` | GET | Georeferenced site geometry for 3D viewer |

---

## Band Integration

Zone-Draft uses Band as the coordination layer for all four agents:

- Each underwriting session creates a Band room named `zone_draft_{sessionId}`.
- Four participants are registered: `intake-parser`, `zoning-compliance`, `spatial-calculator`, `financial-underwriter`.
- Shared context is stored in the room schema (`lot_data`, `zoning_analysis`, `building_envelope`, `financial_analysis`).
- The orchestrator emits structured events (`session.started`, `agent.activated`, `agent.message`, `constraint.violation`, `constraint.resolved`, `session.complete`, `session.error`) that are mirrored to Band messages for auditability.
- If Band is not configured, the app falls back to an in-memory room implementation so local development still works.

---

## Data Sources

| Source | Used For |
|--------|----------|
| **NYC Geoclient / Geocoder API** | Address → coordinates, BBL resolution |
| **MapPLUTO** | Lot area, depth, frontage, zoning district, assessed land, geometry |
| **DOF Rolling Sales** | Neighborhood comparable sales for exit PSF |
| **NYC Zoning Resolution** | FAR tables, UAP, sky exposure, setbacks (RAG via geo-agent) |
| **City of Yes (2024)** | Parking elimination, UAP bonus context |

---

## Export Package

When underwriting completes, download a `.zip` containing:

| File | Contents |
|------|----------|
| `blueprint_report.md` | Full underwriting memo: zoning, envelope, financials, verdict |
| `financial_underwriting.csv` | Line-item pro forma (comps, costs, RLV, verdict) |
| `site_geometry.json` | 3D envelope vertices, setback planes, and/or georeferenced GeoJSON |

---

## UI & Design

The interface is inspired by [Studio Hazey](https://www.studiohazey.com/) with a warm brown palette:

- **Dark:** `#1a120b` / `#2C1810`
- **Cream:** `#EDE4D9`
- **Accent:** `#C8956C`

The landing page introduces the product narrative; the underwriting terminal (`/underwrite`) is a bento-grid tri-panel workbench optimized for live analysis.

---

## Built For

**Band Hackathon 2026 — ForgeOps**

Four agents. One Band room. Zero guesswork.
