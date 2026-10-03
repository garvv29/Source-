# Source? Trust Me Bro API

The API runs on Bun and Express at `http://localhost:3001`. Protected routes require a Supabase access token in `Authorization: Bearer <token>`. Responses use `{ success, data }` on success and `{ error }` on failure. Conversation routes only return or change records owned by the authenticated user.

## Routes

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/health` | Service status | No |
| GET | `/me` | Current account and conversation count | Yes |
| GET | `/history` | List the account's conversations, newest activity first | Yes |
| POST | `/history` | Create a conversation; optional JSON `{ "title": "..." }` | Yes |
| GET | `/history/:id` | Get a conversation and its messages; accepts its id or slug | Yes |
| PATCH | `/history/:id` | Rename with JSON `{ "title": "..." }` | Yes |
| DELETE | `/history/:id` | Delete a conversation and its messages | Yes |
| POST | `/asksource` | Search the web and stream an answer with source links | Yes |
| POST | `/asksource/followup` | Stream a follow-up answer for a conversation | Yes |

Streaming routes return answer text followed by a `\n<SOURCES>\n...\n</SOURCES>` JSON block for the initial search. Follow-ups return answer text only.

## Run locally

```sh
bun install
bun run dev.ts
```

Configure `DATABASE_URL`, `SECRET_KEY` (the Supabase key used by the backend auth client), `TAVILY_API_KEY`, and `AI_GATEWAY_API_KEY` in the backend environment. Apply the checked-in Prisma migrations before serving requests.

## Deploy to Vercel

Create a Vercel project from this repository with its **Root Directory** set to `backend`. The Express app is exported for Vercel's Bun runtime; `bun run dev.ts` starts it locally on Bun. Set `DATABASE_URL`, `SECRET_KEY`, `TAVILY_API_KEY`, and `AI_GATEWAY_API_KEY` in Vercel's environment settings. Apply Prisma migrations to the production database before using the API. Use the resulting deployment URL as `VITE_BACKEND_URL` in the frontend Vercel project.
