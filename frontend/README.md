# Source? Trust Me Bro

The frontend is a Bun-served React app styled with Tailwind CSS and shadcn-style components. It includes Supabase sign-in, searchable conversation history, source-linked answers, follow-up suggestions, and conversation management.

## Run locally

```sh
bun install
bun dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and (optionally) `VITE_BACKEND_URL` in `frontend/.env`. The backend defaults to `http://localhost:3001`; see [the API setup](../backend/README.md) for backend environment variables and migrations.

Build the production assets with `bun run build` and serve them with `bun start`.

## Deploy to Vercel

This repository is a monorepo, so create a Vercel project for each app and set its **Root Directory** to the matching folder:

1. Import the repository and set the first project's Root Directory to `backend`. Vercel will build the Express API as a Node.js function. Add `DATABASE_URL`, `SECRET_KEY`, `TAVILY_API_KEY`, and `AI_GATEWAY_API_KEY` in that project's environment settings. Deploy it and copy its public URL.
2. Create a second Vercel project from the same repository with Root Directory `frontend`. The checked-in `vercel.json` builds the Bun frontend, publishes `dist`, and routes app pages such as `/auth` back to the SPA.
3. Set `VITE_BACKEND_URL` to the API deployment URL and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend project's environment settings. Redeploy after setting them.
4. Apply the checked-in Prisma migrations to the production database before using the app. In Supabase Auth settings, add the frontend production URL to the allowed redirect URLs.

The frontend build fails on Vercel if `VITE_BACKEND_URL` is missing, instead of shipping a site that quietly points at localhost. Local development still defaults to `http://localhost:3001`. Both the API locally and its Vercel deployment use Bun.
