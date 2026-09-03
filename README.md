# Munazara — AI Debate Engine

**A multi-agent debate platform where three specialized AI agents argue both sides of any topic using live web sources, then an independent judge delivers a scored verdict.**

[Live app](https://munazara.manarattar.com) · [About](https://munazara.manarattar.com/about)

---

## What it does

Enter any debate topic. Three specialized AI agents run a full structured debate:

- **PRO agent** — advocates for the topic with real web sources, persistent memory across all rounds
- **CON agent** — argues against, with its own separate evidence pipeline and conversation history
- **Judge agent** — reads both sides with zero prior context, delivers a scored verdict

The debate runs across four rounds:

1. **Opening statements** — each side builds its case from live-retrieved sources
2. **Rebuttals** — each side attacks the opponent's arguments using its own memory of what it argued
3. **Cross-examination** — each side interrogates the other with pointed questions
4. **Closing statements** — final summaries referencing the full debate history

You can also **debate the AI yourself** — choose your side, write your opening, and see if you can beat it.

### Features
- Real-time streaming — arguments appear token by token as they're generated
- Web-sourced arguments — Tavily search grounds every claim in actual sources
- Fact-checking — post-debate fact check on the key claims made
- Before/after voting — see if the debate changed your mind
- Argument reactions — like or dislike individual arguments
- Persona mode — tell the AI to debate as Einstein vs Keynes, or any two personas
- PDF export — download the full debate transcript
- Knowledge graph — visual map of all past debates
- Shareable links — share any debate with a URL

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Auth | Clerk |
| Backend | FastAPI, SQLAlchemy, Uvicorn |
| LLM | OpenAI GPT-4o-mini |
| Web search | Tavily API |
| Vector store | ChromaDB (per-debate, ephemeral) |
| Database | PostgreSQL (Render) |
| Deployment | Self-hosted on a Contabo VPS (Docker Compose + Caddy) — see DEPLOYMENT.md |
| Error monitoring | Sentry |

---

## Running locally

### Prerequisites
- Node 18+
- Python 3.11+
- An OpenAI API key
- A Tavily API key (free tier at [tavily.com](https://tavily.com))
- A Clerk account (free at [clerk.com](https://clerk.com))

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env   # fill in your keys
uvicorn app.main:app --reload --port 8002
```

### Frontend

```bash
cd frontend
npm install
# Create frontend/.env.local with:
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# VITE_API_URL=http://localhost:8002
npm run dev
```

---

## Deploying to production

### 1. Clerk — get production keys

1. Go to [clerk.com](https://clerk.com) → create a new application
2. **Configure → API Keys** → copy the **Publishable Key** (`pk_live_...`)
3. Copy the **JWKS endpoint URL** (format: `https://your-domain.clerk.accounts.dev/.well-known/jwks.json`)

### 2. OpenAI — get your API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key

### 3. Tavily — get your API key

1. Go to [tavily.com](https://tavily.com) → sign up → copy your API key

### 4. Sentry — create projects (optional but recommended)

1. [sentry.io](https://sentry.io) → create two projects: one Python/FastAPI, one React
2. Copy each DSN

### 5. Deploy backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint**
3. Connect your GitHub repo — Render will detect `render.yaml` automatically
4. In the Render dashboard, add the secret env vars (marked `sync: false` in render.yaml):
   - `OPENAI_API_KEY`
   - `TAVILY_API_KEY`
   - `CLERK_JWKS_URL`
   - `SENTRY_DSN` (optional)
5. Deploy — Render will build the Docker container and provision a Postgres database

### 6. Deploy

Frontend and backend both run on a single VPS behind Caddy, which serves the
built SPA and proxies `/api/*` to the backend on the same origin. There is no
Vercel or Render involved.

Full instructions, including the Clerk build-time trap, are in
[DEPLOYMENT.md](DEPLOYMENT.md).

---

## Environment variables reference

See [`.env.example`](.env.example) for all backend variables with descriptions.

---

## Project structure

```
munazara/
├── backend/
│   ├── app/
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── database.py         # SQLAlchemy models
│   │   ├── main.py             # FastAPI app + Sentry init
│   │   ├── dependencies/
│   │   │   └── auth.py         # Clerk JWT verification
│   │   ├── routers/
│   │   │   ├── debate.py       # AI debate endpoints + rate limiting
│   │   │   ├── human_debate.py # Human vs AI endpoints
│   │   │   ├── factcheck.py    # Fact-check endpoint
│   │   │   ├── vote.py         # Before/after voting
│   │   │   ├── reaction.py     # Argument reactions
│   │   │   ├── export_pdf.py   # PDF export
│   │   │   └── graph.py        # Knowledge graph data
│   │   └── services/
│   │       ├── debate_orchestrator.py  # Full debate flow (streaming SSE)
│   │       ├── debate_agent.py         # LLM calls
│   │       ├── source_collector.py     # Tavily web search
│   │       ├── debate_indexer.py       # ChromaDB indexing
│   │       └── fact_checker.py         # Fact-checking logic
│   ├── Dockerfile
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   └── src/
│       ├── App.jsx             # Main app state machine
│       └── components/         # UI components
├── render.yaml                 # Render deployment config
└── .env.example                # All env vars documented
```

---

## Author

**Manar Attar** — [LinkedIn](https://linkedin.com/in/manarattar) · [GitHub](https://github.com/manarattar)
