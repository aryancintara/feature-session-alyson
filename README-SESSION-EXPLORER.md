# Alyson Session Explorer (integration snapshot)

Session Explorer work ported into Alyson web frontend (Data → Sessions).

## Included
- `src/features/sessions/` – Session Explorer UI + parsers + client API
- `server/sessionApiRoutes.js` – local Vite proxy for Session API (keeps `SESSION_API_KEY` server-side)
- Route/proxy wiring files used in Alyson

## Source
Based on [feature-session-alyson](https://github.com/aryancintara/feature-session-alyson) Session Explorer, integrated into Alyson locally.

## Local env
Add to your Alyson env file (not committed):

```
SESSION_API_KEY=your-key
```
