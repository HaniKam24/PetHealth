# Deploying to Render (the "always-on preview link")

This sets up a permanent link you can click anytime to see the latest version
of PetHealth that's been pushed to `main` — no need to ask Claude Code for a
local link. Render rebuilds and redeploys automatically every time `main`
changes.

This is a **one-time setup**, done by a human in the Render dashboard (Claude
Code can't create the hosted services or enter your secret keys for you).

## What gets created

Two services, both free tier, both auto-deploying from `main`:

- **`pethealth-frontend`** — the React app. This is the link you bookmark.
- **`pethealth-api`** — the backend the frontend talks to. You won't visit
  this one directly.

> **Heads up on the free tier:** the backend "spins down" after 15 minutes of
> no traffic. The first request after a quiet period takes ~30-50 seconds to
> wake it back up (the page will look like it's loading, then catch up). This
> only happens on the backend, and only after a period of nobody looking at
> the site. Upgrading `pethealth-api` to Render's $7/mo plan removes this.

## Setup steps

1. Go to [dashboard.render.com](https://dashboard.render.com) and sign up /
   log in (free).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account if you haven't, then pick the
   `HaniKam24/PetHealth` repo. Render will find `render.yaml` at the repo
   root automatically and show you the two services it's about to create.
4. Click **Apply**. Render will ask you to fill in a few values it can't
   know on its own (these are your secrets — same ones from your local
   `.env` file):
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY` (same publishable key as below — the backend's
     `@clerk/express` middleware needs it too, or it 500s on every request)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY` (from Clerk's dashboard — this one is *not*
     secret, it's the public key, but Render still asks for it explicitly)
   - `WEB_ORIGIN` — leave this blank for now; come back and fill it in after
     step 5 below.
5. Wait for both services to finish their first deploy (a few minutes).
   Render will show you the frontend's URL, something like
   `https://pethealth-frontend.onrender.com` — **that's your link.**
6. Go back to the `pethealth-api` service → **Environment** → set
   `WEB_ORIGIN` to the frontend URL from step 5 (e.g.
   `https://pethealth-frontend.onrender.com`) → save. This lets the backend
   accept requests from your frontend directly, as a fallback to the proxy
   rule already set up in `render.yaml`.

That's it. From now on, every push to `main` (including a merged PR)
triggers a fresh deploy automatically — the link always shows the latest
pushed version.

## If the service name `pethealth-api` or `pethealth-frontend` is taken

Render appends a random suffix to your service's URL if the name is already
used by someone else. If that happens to `pethealth-api`, update the
`destination` in the `/api/*` rewrite rule inside `render.yaml` (repo root)
to match the actual URL Render gave it, then push that change to `main`.

## Checking a deploy

Each service's Render dashboard page has a **Logs** tab and shows build
status (building / live / failed) — useful if a deploy doesn't show your
latest change after a push.
