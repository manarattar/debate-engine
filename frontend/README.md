# Munazara — Frontend

React 19 + Vite + Tailwind CSS v4 frontend for [Munazara](https://munazara.manarattar.com).

See the [root README](../README.md) for the full project overview and setup guide.

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm run lint       # ESLint
```

## Environment variables

Create `frontend/.env.local`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # or pk_live_... in production
VITE_API_URL=http://localhost:8002        # backend URL
VITE_SENTRY_DSN=                         # optional
```
